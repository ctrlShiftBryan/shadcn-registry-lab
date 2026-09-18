import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { addRegistryItems, getRegistryItems } from "shadcn/registry";
import { captureInstallation, readManifest, record, status } from "./core.ts";

const repo = fileURLToPath(new URL("../", import.meta.url));
const lab = join(repo, ".lab");
await mkdir(lab, { recursive: true });
const cwd = await mkdtemp(join(lab, "consumer-"));
const source = "https://ui.shadcn.com/r/styles/new-york-v4/button.json";
console.log("Fetching official shadcn button into " + cwd);
const [item] = await getRegistryItems([source], { useCache: false });
if (!item || item.name !== "button" || item.registryDependencies?.length || item.files?.length !== 1 ||
    item.files[0].type !== "registry:ui") {
  throw new Error("Upstream button shape changed. Review this adapter before installing.");
}
const artifact = JSON.stringify(item, null, 2) + "\n";
const artifactPath = join(cwd, "button.registry.json");
await writeFile(artifactPath, artifact);
await mkdir(join(cwd, "src/components/ui"), { recursive: true });
await mkdir(join(cwd, "src/lib"), { recursive: true });
await writeFile(join(cwd, "package.json"), JSON.stringify({
  name: "registry-lab-consumer", version: "0.0.0", private: true, type: "module",
  packageManager: "pnpm@10.30.1",
  dependencies: {
    react: "19.2.0", "react-dom": "19.2.0", "class-variance-authority": "0.7.1",
    clsx: "2.1.1", "tailwind-merge": "3.3.1"
  }
}, null, 2));
await writeFile(join(cwd, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
await writeFile(join(cwd, "tsconfig.json"), JSON.stringify({
  compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } }
}, null, 2));
await writeFile(join(cwd, "src/index.css"), '@import "tailwindcss";\n');
await writeFile(join(cwd, "src/lib/utils.ts"), 'import { clsx, type ClassValue } from "clsx"\nimport { twMerge } from "tailwind-merge"\nexport function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }\n');
const config = {
  style: "new-york", rsc: false, tsx: true,
  tailwind: { config: "", css: "src/index.css", baseColor: "neutral", cssVariables: true, prefix: "" },
  aliases: { components: "@/components", ui: "@/components/ui", utils: "@/lib/utils", lib: "@/lib", hooks: "@/hooks" },
  iconLibrary: "lucide",
  resolvedPaths: {
    cwd, tailwindConfig: "", tailwindCss: join(cwd, "src/index.css"),
    components: join(cwd, "src/components"), ui: join(cwd, "src/components/ui"),
    utils: join(cwd, "src/lib/utils"), lib: join(cwd, "src/lib"), hooks: join(cwd, "src/hooks")
  }
};
const { resolvedPaths, ...publicConfig } = config;
await writeFile(join(cwd, "components.json"), JSON.stringify(publicConfig, null, 2));
await writeFile(join(cwd, "install-config.json"), JSON.stringify(config, null, 2));
await addRegistryItems([artifactPath], { cwd, config, silent: true, overwrite: false });
const installed = "src/components/ui/button.tsx";
await captureInstallation(cwd, "button", source, artifact, [installed]);
console.log("1. Installed:", (await status(cwd)).components[0].source);
const before = await readManifest(cwd);
const buttonPath = resolve(cwd, installed);
await writeFile(buttonPath, (await readFile(buttonPath, "utf8")) + "\n// Prototype customization: consumer-owned button.\n");
console.log("2. Edited:", (await status(cwd)).components[0].acknowledgement);
await record(cwd, "button", "Demonstrate an intentional local customization");
console.log("3. Recorded:", (await status(cwd)).components[0].acknowledgement);
const after = await readManifest(cwd);
if (JSON.stringify(before.components.button.files) !== JSON.stringify(after.components.button.files)) {
  throw new Error("Recording changed the upstream baseline");
}
console.log("\nConsumer left on disk for exploration:");
console.log("pnpm ds status --cwd " + cwd);
console.log("pnpm ds diff button --cwd " + cwd);
console.log("pnpm ds check --strict --json --cwd " + cwd);
console.log("\nScope: component files only. Compatibility, updates, and shared CSS are not checked.");

