import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

export const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export type InstalledFile = { path: string; baseline: string };
export type Component = {
  source: string;
  artifactDigest: string;
  installer: string;
  files: InstalledFile[];
  customization?: { fingerprint: string; reason: string };
};
export type Manifest = { schemaVersion: 1; components: Record<string, Component> };
export type Finding = {
  code: "DS001" | "DS002" | "DS003";
  severity: "warning" | "error";
  component: string;
  path?: string;
  message: string;
};
export type Status = {
  schemaVersion: 1;
  components: Array<{
    id: string;
    source: "unchanged" | "modified" | "missing" | "invalid";
    acknowledgement: "not-needed" | "recorded" | "required";
    upstream: "not-checked";
    compatibility: "not-checked";
    changedFiles: string[];
    fingerprint: string;
  }>;
  findings: Finding[];
};

// All tracked paths are relative; symbolic links are deliberately unsupported.
async function filePath(root: string, path: string): Promise<string> {
  if (!path || isAbsolute(path) || path.includes("\\") || path.split("/").some(p => !p || p === "." || p === "..")) {
    throw new Error("Invalid tracked path: " + path);
  }
  let current = resolve(root);
  for (const segment of path.split("/")) {
    current = join(current, segment);
    try {
      if ((await lstat(current)).isSymbolicLink()) throw new Error("Symbolic links are unsupported: " + path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return current;
}

async function optionalRead(path: string): Promise<Buffer | undefined> {
  try { return await readFile(path); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function validateManifest(value: unknown): asserts value is Manifest {
  const m = value as Manifest;
  if (!m || m.schemaVersion !== 1 || !m.components || typeof m.components !== "object" || Array.isArray(m.components)) {
    throw new Error("Invalid ds.lock.json schema");
  }
  const paths = new Set<string>();
  for (const [id, item] of Object.entries(m.components)) {
    if (!id || !item || typeof item.source !== "string" || typeof item.installer !== "string" ||
      !/^[a-f0-9]{64}$/.test(item.artifactDigest) || !Array.isArray(item.files) || !item.files.length) {
      throw new Error("Invalid component record: " + id);
    }
    for (const file of item.files) {
      if (!file || typeof file.path !== "string" || !/^[a-f0-9]{64}$/.test(file.baseline) ||
        paths.has(file.path) || file.path === "ds.lock.json" || file.path.startsWith(".ds/")) {
        throw new Error("Invalid or multiply owned component file: " + id);
      }
      paths.add(file.path);
    }
    if (item.customization && (typeof item.customization.reason !== "string" ||
      !item.customization.reason.trim() || !/^[a-f0-9]{64}$/.test(item.customization.fingerprint))) {
      throw new Error("Invalid customization record: " + id);
    }
  }
}

export async function readManifest(root: string): Promise<Manifest> {
  const bytes = await optionalRead(await filePath(root, "ds.lock.json"));
  if (!bytes) throw new Error("No ds.lock.json found. Run pnpm demo to create a tracked consumer.");
  const manifest: unknown = JSON.parse(bytes.toString("utf8"));
  validateManifest(manifest);
  return manifest;
}

async function writeManifest(root: string, manifest: Manifest): Promise<void> {
  validateManifest(manifest);
  const target = await filePath(root, "ds.lock.json");
  const temporary = await filePath(root, "ds.lock.json.tmp");
  await writeFile(temporary, JSON.stringify(manifest, null, 2) + "\n");
  await rename(temporary, target);
}

// Called only for the fresh isolated installation owned by the demo adapter.
// This is not an "adopt whatever is on disk as upstream" CLI command.
export async function captureInstallation(
  root: string, id: string, source: string, artifact: string, paths: string[]
): Promise<void> {
  if (await optionalRead(await filePath(root, "ds.lock.json"))) throw new Error("Consumer is already tracked");
  if (!paths.length) throw new Error("No installed files were provided");
  const files: InstalledFile[] = [];
  for (const path of [...paths].sort()) {
    const content = await readFile(await filePath(root, path));
    const hash = digest(content);
    const baseline = await filePath(root, ".ds/baselines/" + hash);
    await mkdir(dirname(baseline), { recursive: true });
    await writeFile(baseline, content);
    files.push({ path, baseline: hash });
  }
  const artifactDigest = digest(artifact);
  const artifactPath = await filePath(root, ".ds/artifacts/" + artifactDigest + ".json");
  await mkdir(dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, artifact);
  await writeManifest(root, { schemaVersion: 1, components: {
    [id]: { source, artifactDigest, installer: "shadcn@4.21.0", files }
  } });
}

async function inspect(root: string, manifest: Manifest): Promise<Status> {
  const result: Status = { schemaVersion: 1, components: [], findings: [] };
  for (const [id, item] of Object.entries(manifest.components).sort(([a], [b]) => a.localeCompare(b))) {
    const changes: Array<[string, string]> = [];
    let missing = false;
    let invalid = false;
    const artifact = await optionalRead(await filePath(root, ".ds/artifacts/" + item.artifactDigest + ".json"));
    if (!artifact || digest(artifact) !== item.artifactDigest) {
      invalid = true;
      result.findings.push({ code: "DS003", severity: "error", component: id, message: "Original registry artifact is missing or corrupt." });
    }
    for (const file of item.files) {
      const baseline = await optionalRead(await filePath(root, ".ds/baselines/" + file.baseline));
      if (!baseline || digest(baseline) !== file.baseline) {
        invalid = true;
        result.findings.push({ code: "DS003", severity: "error", component: id, path: file.path, message: "Installed baseline is missing or corrupt." });
      }
      const current = await optionalRead(await filePath(root, file.path));
      if (!current) {
        missing = true;
        changes.push([file.path, "missing"]);
        result.findings.push({ code: "DS002", severity: "error", component: id, path: file.path, message: "Tracked file is missing." });
      } else if (digest(current) !== file.baseline) {
        changes.push([file.path, digest(current)]);
      }
    }
    const fingerprint = digest(JSON.stringify({ artifact: item.artifactDigest, baselines: item.files, changes }));
    const acknowledgement = changes.length === 0 ? "not-needed" :
      item.customization?.fingerprint === fingerprint ? "recorded" : "required";
    if (changes.length && !missing && !invalid && acknowledgement === "required") {
      result.findings.push({ code: "DS001", severity: "warning", component: id, message: "Local customization is not recorded. Inspect with ds diff, then use ds record with a reason." });
    }
    result.components.push({
      id, source: invalid ? "invalid" : missing ? "missing" : changes.length ? "modified" : "unchanged",
      acknowledgement, changedFiles: changes.map(([path]) => path), fingerprint,
      upstream: "not-checked", compatibility: "not-checked"
    });
  }
  return result;
}

export async function status(root: string): Promise<Status> {
  return inspect(root, await readManifest(root));
}

export async function record(root: string, id: string, reason: string): Promise<Status> {
  if (!reason.trim()) throw new Error("A nonempty customization reason is required");
  const manifest = await readManifest(root);
  const report = await inspect(root, manifest);
  const entry = report.components.find(c => c.id === id);
  if (!entry) throw new Error("Unknown component: " + id);
  if (entry.source !== "modified") throw new Error("Only modified components with valid baselines can be recorded");
  manifest.components[id].customization = { fingerprint: entry.fingerprint, reason: reason.trim() };
  await writeManifest(root, manifest);
  return status(root);
}

export async function diff(root: string, id: string): Promise<string> {
  const manifest = await readManifest(root);
  const item = manifest.components[id];
  if (!item) throw new Error("Unknown component: " + id);
  const report = await inspect(root, manifest);
  if (report.findings.some(f => f.component === id && f.code === "DS003")) {
    throw new Error("Cannot diff against missing or corrupt provenance");
  }
  const output: string[] = [];
  for (const file of item.files) {
    const baseline = await filePath(root, ".ds/baselines/" + file.baseline);
    const current = await filePath(root, file.path);
    if (!(await optionalRead(current))) { output.push("Missing tracked file: " + file.path); continue; }
    const run = spawnSync("git", ["diff", "--no-index", "--no-ext-diff", "--no-color", "--", baseline, current], { encoding: "utf8" });
    if (run.error) throw run.error;
    if (run.status !== 0 && run.status !== 1) throw new Error(run.stderr || "git diff failed");
    if (run.stdout) output.push(run.stdout);
  }
  return output.join("\n") || "No local changes.";
}

