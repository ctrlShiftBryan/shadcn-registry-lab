# shadcn registry lab

A prototype for tracking shadcn component source while allowing local customization.

The experiment asks whether developers and coding agents can distinguish upstream code, local edits, and recorded customizations. A TypeScript CLI checks retained installation baselines without an LLM or network connection. It is not a production package manager.

The intended consuming architecture is Module Federation with React microfrontends in the same page. Consumer customization is intentional. The current implementation is still the CLI experiment; the [host integration plan](plans/1789755844--9-18-2:24pm--evaluate-module-federation-integration.md) describes the next evaluation.

## Run it

Requires Node 24+, pnpm 10.30.1, and Git. Tool versions are declared in .tool-versions and package.json.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm demo
```

The demo fetches the official shadcn button and installs it through the public shadcn registry API. It creates a fresh disposable consumer under .lab/ and prints commands for inspecting it. Installation needs network access; status, diff, record, and check run offline.

The demo makes a comment-only customization, records its reason, and leaves the consumer on disk:

```text
1. Installed: unchanged
2. Edited: required
3. Recorded: recorded
```

Run the printed diff command, edit the button again, and run check --strict. The new edit requires a new record. The original baseline remains unchanged.

## CLI

Replace CONSUMER with the path printed by the demo.

```sh
pnpm --silent ds status --cwd CONSUMER
pnpm --silent ds diff button --cwd CONSUMER
pnpm --silent ds record button --reason "Explain the local change" --cwd CONSUMER
pnpm --silent ds check --strict --json --cwd CONSUMER
```

Use --json for structured output. Use pnpm --silent, or invoke node src/cli.ts directly, when parsing stdout.

Exit codes:

- 0: operation succeeded; check found no failing diagnostics.
- 1: check found an error, or --strict found an unrecorded customization.
- 2: tool error, invalid input, or unreadable project metadata.

Local modifications are warnings by default. Recorded customizations remain visibly modified and can pass strict checks. Upstream update status and compatibility are explicitly reported as not checked.

## What is retained

Each disposable consumer contains:

- ds.lock.json: tracked paths, original content hashes, source artifact identity, and customization records.
- .ds/baselines/: original installed file contents, after shadcn processing.
- .ds/artifacts/: the fetched registry item addressed by its content hash.
- button.registry.json and install-config.json: the source snapshot and installation inputs.
- package.json and pnpm-lock.yaml: the consumer's installed dependency resolutions.

Source content hashes identify the exact fetched artifact. The live upstream URL is mutable, so separate demo runs may fetch different button revisions.

Acknowledgements are bound to a fingerprint of the current difference. They never redefine the original baseline. The demo only captures a fresh installation it created; the CLI provides no command to treat arbitrary existing files as pristine upstream.

## Scope

Implemented:

- A real shadcn@4.21.0 button installation in an isolated consumer.
- Offline source-file status and Git-based diffs.
- Intentional customization records that become stale when content changes.
- Missing-file and baseline/artifact integrity checks.
- Human-readable and JSON output.
- Type checking, 12 deterministic tests, and GitHub Actions.

Not implemented:

- General installation into existing applications.
- Update merging, upstream version discovery, or contribution submission.
- Registry dependency graph tracking or shared-file ownership.
- CSS/config provenance, compatibility analysis, or behavior/accessibility validation.
- MCP, ESLint integration, agent skills, or an editor extension.

This is a CLI experiment, not a runnable UI showcase. The generated button is not rendered. Tests validate tracking behavior, not its appearance or accessibility.

Concurrent writers and hostile repository tampering are outside the prototype's scope. Baseline hashes detect accidental corruption; they are not an independent authenticity guarantee. New untracked files are not automatically discovered.

## Research

- [Distribution decision](docs/research/distribution.md)
- [Tooling architecture](docs/research/tooling.md)
- [Prototype plan](plans/1789739564--9-18-9:52am--prototype-registry-component-tracking.md)
- [Recorded results](docs/prototype-results.md)

The research describes the larger proposal. The scope above is the authoritative list of what this repository currently does.

References: [shadcn registry API](https://ui.shadcn.com/docs/registry/api-reference), [shadcn CLI](https://ui.shadcn.com/docs/cli), [shadcn/ui source](https://github.com/shadcn-ui/ui).
