import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import type { TestContext } from "node:test";
import { captureInstallation, diff, readManifest, record, status } from "../src/core.ts";

const original = 'import { cn } from "@/lib/utils"\nexport const Button = () => cn("button")\n';
const upstream = 'import { cn } from "@/registry/lib/utils"\nexport const Button = () => cn("button")\n';
const tracked = "src/button.tsx";

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "ds-lab-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "src"));
  await writeFile(join(root, tracked), original);
  await captureInstallation(root, "button", "https://example.test/button.json", JSON.stringify({ files: [{ content: upstream }] }), [tracked]);
  return root;
}

test("compares against transformed installed content, not raw upstream", async t => {
  const root = await fixture(t);
  const report = await status(root);
  assert.equal(report.components[0].source, "unchanged");
  assert.equal(report.components[0].acknowledgement, "not-needed");
  assert.equal(report.components[0].upstream, "not-checked");
  assert.deepEqual(report.findings, []);
});

test("recording preserves baseline; further changes require a new record", async t => {
  const root = await fixture(t);
  const before = await readManifest(root);
  await writeFile(join(root, tracked), original + "// first edit\n");
  const modified = await status(root);
  assert.equal(modified.components[0].source, "modified");
  assert.equal(modified.findings[0].code, "DS001");
  assert.match(await diff(root, "button"), /\+\/\/ first edit/);
  const recorded = await record(root, "button", "Add application-specific behavior");
  assert.equal(recorded.components[0].source, "modified");
  assert.equal(recorded.components[0].acknowledgement, "recorded");
  assert.deepEqual(recorded.findings, []);
  assert.deepEqual((await readManifest(root)).components.button.files, before.components.button.files);
  await writeFile(join(root, tracked), original + "// another edit\n");
  assert.equal((await status(root)).components[0].acknowledgement, "required");
  await writeFile(join(root, tracked), original);
  assert.equal((await status(root)).components[0].source, "unchanged");
});

test("missing files fail and cannot be acknowledged", async t => {
  const root = await fixture(t);
  await unlink(join(root, tracked));
  const report = await status(root);
  assert.equal(report.components[0].source, "missing");
  assert.equal(report.findings[0].code, "DS002");
  await assert.rejects(record(root, "button", "Missing"), /Only modified/);
});

test("corrupt baseline fails instead of hiding differences", async t => {
  const root = await fixture(t);
  const manifest = await readManifest(root);
  await writeFile(join(root, ".ds/baselines", manifest.components.button.files[0].baseline), "corrupt");
  const report = await status(root);
  assert.equal(report.components[0].source, "invalid");
  assert.equal(report.findings[0].code, "DS003");
  await assert.rejects(diff(root, "button"), /corrupt provenance/);
});

test("corrupt source artifact is reported", async t => {
  const root = await fixture(t);
  const manifest = await readManifest(root);
  await writeFile(join(root, ".ds/artifacts", manifest.components.button.artifactDigest + ".json"), "{}");
  assert.equal((await status(root)).components[0].source, "invalid");
});

test("refuses silent recapture and empty acknowledgement reasons", async t => {
  const root = await fixture(t);
  await assert.rejects(captureInstallation(root, "button", "url", "{}", [tracked]), /already tracked/);
  await assert.rejects(record(root, "button", " "), /nonempty/);
  await assert.rejects(record(root, "button", "no change"), /Only modified/);
  await assert.rejects(diff(root, "unknown"), /Unknown component/);
});

test("refuses tracked paths outside the consumer", async t => {
  const root = await fixture(t);
  const manifest = await readManifest(root);
  manifest.components.button.files[0].path = "../outside.tsx";
  await writeFile(join(root, "ds.lock.json"), JSON.stringify(manifest));
  await assert.rejects(status(root), /Invalid tracked path/);
});

test("refuses a symbolic link replacing a tracked file", async t => {
  const root = await fixture(t);
  await writeFile(join(root, "other.tsx"), original);
  await unlink(join(root, tracked));
  await symlink(join(root, "other.tsx"), join(root, tracked));
  await assert.rejects(status(root), /Symbolic links/);
});

test("refuses duplicate ownership of a file", async t => {
  const root = await fixture(t);
  const manifest = await readManifest(root);
  manifest.components.other = structuredClone(manifest.components.button);
  await writeFile(join(root, "ds.lock.json"), JSON.stringify(manifest));
  await assert.rejects(status(root), /multiply owned/);
});

test("rejects unsupported manifest versions", async t => {
  const root = await fixture(t);
  await writeFile(join(root, "ds.lock.json"), '{"schemaVersion":2,"components":{}}');
  await assert.rejects(status(root), /schema/);
});

test("CLI emits parseable JSON and separates policy failures from errors", async t => {
  const root = await fixture(t);
  const cli = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
  function run(...args: string[]) {
    return spawnSync(process.execPath, [cli, ...args, "--cwd", root, "--json"], { encoding: "utf8" });
  }
  assert.equal(run("check", "--strict").status, 0);
  await writeFile(join(root, tracked), original + "// changed\n");
  assert.equal(run("check").status, 0);
  const unrecorded = run("check", "--strict");
  assert.equal(unrecorded.status, 1);
  assert.equal(JSON.parse(unrecorded.stdout).findings[0].code, "DS001");
  assert.equal(run("record", "button", "--reason", "An intentional edit").status, 0);
  assert.equal(run("check", "--strict").status, 0);
  const unknown = run("diff", "unknown");
  assert.equal(unknown.status, 2);
  assert.equal(JSON.parse(unknown.stdout).error.code, "DS_TOOL_ERROR");
  const invalidOption = run("status", "--bogus");
  assert.equal(invalidOption.status, 2);
  assert.equal(JSON.parse(invalidOption.stdout).error.code, "DS_TOOL_ERROR");
});

test("retains source and installed contents independently", async t => {
  const root = await fixture(t);
  const item = (await readManifest(root)).components.button;
  const artifact = await readFile(join(root, ".ds/artifacts", item.artifactDigest + ".json"), "utf8");
  const baseline = await readFile(join(root, ".ds/baselines", item.files[0].baseline), "utf8");
  assert.equal(JSON.parse(artifact).files[0].content, upstream);
  assert.equal(baseline, original);
});

