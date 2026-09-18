# Tooling for a source-distributed design system

Date: September 18, 2026. Status: proposed architecture, not implemented or installed.

## Recommendation

Build a small deterministic TypeScript engine with a local CLI. Make that engine the source of truth for installation provenance, local differences, update planning, and compatibility checks. Add editor feedback through ESLint and a CLI watcher, agent procedures through skills, and an optional MCP adapter over the same engine.

Prioritize local CLI, provenance, CI, and one agent workflow before a custom MCP server or central dashboard. The current shadcn MCP server already supports discovery and installation workflows for compatible private registries. [shadcn MCP](https://ui.shadcn.com/docs/mcp), [registry MCP prerequisites](https://ui.shadcn.com/docs/registry/mcp).

The product objective is visible, supported customization. A local change should be easy to detect and document without requiring central permission. Detection of differences is straightforward; determining behavioral compatibility and merging changes correctly require more work.

## One engine, several interfaces

- Core library: pure comparison and validation functions over explicit inputs.
- CLI: human-readable output, versioned JSON output, stable diagnostic codes and documented exit codes.
- CI: the same CLI with repository-pinned policy and registry metadata.
- ESLint: source-level usage rules; optional projection of local status with explicit cache invalidation.
- Skills: procedures for selecting components, changing them, upgrading them, and preparing contributions.
- MCP: typed wrappers around the same core operations, plus version-specific documentation resources.

All command and tool names below are proposed company interfaces. They are not existing shadcn commands.

## Provenance model

Commit a ds.lock.json and a small .ds directory containing reproducible baseline material and intentional-change records.

For each registry item, record:

- Stable item identity, source location, exact upstream revision, and source artifact digest.
- Exact CLI/installer version, transformation configuration, and formatting configuration.
- Resolved registry dependency graph and required npm dependency constraints; actual npm resolutions remain in the application package lockfile.
- Each installed path and a reference to its original installed content.
- Ownership of shared files and affected consumers.
- Supported token, utility, and runtime contract versions.
- Relevant documentation and migration identifiers.

Keep pristine registry content separately from the installed baseline. The installed baseline is the reproducible result after path rewriting, aliases, language conversion, and formatting. Hashing raw upstream content against installed files would produce false positives.

Use content hashes for detection and retain baseline content for diffs and merges. A digest alone cannot perform a three-way merge. Start with exact content under a documented line-ending convention. A later formatter-normalized comparison can label formatting-only differences, but must not claim arbitrary AST normalization proves semantic equivalence.

Registry installation can also change CSS, config, and package manifests. Track owned CSS fragments, config keys, and dependency changes without claiming entire application-owned files as component files. Favor a dedicated generated design-system stylesheet where practical. Shared utilities have one installed identity referenced by all affected components.

An installer must derive the baseline from pristine artifacts in a temporary project matching the recorded transform inputs. It must not silently snapshot an already modified working file as pristine. Update source, metadata, and relevant locks coherently.

For existing installations whose origin cannot be established, report unknown provenance and reconcile it explicitly. Do not label guessed baselines as verified.

## Local change records

Keep intentional customization separately from the upstream baseline. Record component, owner, reason, upstream revision, and fingerprint of the acknowledged local difference. An upstream issue or PR is optional.

Acknowledging a difference changes its policy status, not its origin. It remains locally modified. A new change to the acknowledged patch requires renewed acknowledgement; an old blanket exception cannot hide new edits.

This is evidence and accountability, not a tamper-proof security mechanism. Developers control their repository. CI can verify baselines against immutable upstream artifacts and review changes to provenance/policy files.

Represent independent status dimensions:

- Source: unchanged, modified, missing, or unknown.
- Acknowledgement: unnecessary, recorded, or required.
- Upstream: current, update available, or unknown, with metadata revision and checked time.
- Compatibility: supported, unsupported, or unknown.
- Contribution: none, prepared, submitted, or accepted.

A component can be modified, acknowledged, supported, and have an update available simultaneously.

## Proposed CLI

| Command | Responsibility |
| --- | --- |
| pnpm ds add button | Install through a pinned shadcn adapter and record pristine provenance |
| pnpm ds status | Show local state, acknowledgements, and update freshness |
| pnpm ds diff button | Show exactly how current content differs from its installed baseline |
| pnpm ds record button --reason "..." | Acknowledge the current difference without replacing the baseline |
| pnpm ds check --json | Offline reproducible checks with stable diagnostics |
| pnpm ds updates refresh | Explicitly fetch and pin a new registry metadata snapshot |
| pnpm ds update button --to REV --dry-run | Compute file/dependency/config changes and merge conflicts |
| pnpm ds contribute button --prepare | Produce a scoped patch, explanation, and validation record |

CLI output should include diagnostic code, component ID, path/range where available, severity, observed and expected state, evidence, and a structured next action. JSON output should have a schema version. Reserve distinct exit outcomes for passed checks, policy failures, and tool execution errors.

Local checking needs no network. Upstream freshness comes from an explicit refresh and a dated metadata snapshot. Unknown or stale update information must never be reported as current.

The standard shadcn CLI already offers add previews, diffs, and dependency installation. For programmatic integration, prefer the documented shadcn/registry and shadcn/schema APIs through a pinned adapter. getRegistryItems fetches items, resolveRegistryItems resolves dependency trees, and addRegistryItems installs them. Only documented imports are public APIs. Verify actual outcomes: existing files may be skipped, and long-lived processes must explicitly refresh mutable registry responses. Custom provenance and acknowledgement semantics belong to the company tool. [shadcn CLI](https://ui.shadcn.com/docs/cli), [public registry APIs](https://ui.shadcn.com/docs/registry/api-reference).

## Diagnostics and enforcement

| Condition | Developer feedback | Suggested CI policy |
| --- | --- | --- |
| New local modification | Explain difference and offer record/contribute actions | Start as warning; later require acknowledgement where appropriate |
| Recorded customization | Visible informational status | Pass if checks and compatibility requirements pass |
| Compatible update available | Show change summary and update action | Advisory |
| Unresolved merge conflict | Point to conflict | Fail |
| Tracked component file missing unexpectedly | Show installed path and dependents | Fail unless an explicit removal updates inventory |
| Unsupported dependency or token combination | Explain actual constraint mismatch | Fail |
| Missing or invalid provenance | Explain what could not be verified | Fail strict checks; allow a deliberate initial migration period |

The policy is versioned and shared by local and CI runs. It should allow consumer teams to record intentional changes without waiting for the central design-system team.

## ESLint and editor feedback

Use ESLint for syntax-aware checks in JS/TS/JSX/TSX:

- Restricted imports where application code must use the company's wrapper. Exempt the wrapper implementation itself.
- Deprecated component props or exports based on versioned metadata.
- Supported semantic token usage in statically analyzable className/style expressions.
- Selected API or composition rules that can actually be proven statically.

Prefer existing rules before writing custom ones. ESLint supports restricted-import rules, custom diagnostics, suggestions, and fixes. Use fixes only for unambiguous transformations. [no-restricted-imports](https://eslint.org/docs/latest/rules/no-restricted-imports), [custom rules](https://eslint.org/docs/latest/extend/custom-rules).

Whole-repository provenance checks should run in the CLI. Deleted files, registry dependencies, CSS/config changes, and manifest conflicts do not fit naturally into a rule visiting one existing TSX file. Avoid network requests inside rules.

If editor lint rules read external metadata, invalidate their results when that metadata changes. ESLint caches processed-file results; changes outside the source file can otherwise leave a custom integration stale. This is an integration risk inferred from its caching model. [ESLint CLI caching](https://eslint.org/docs/latest/use/command-line-interface#--cache).

For immediate feedback, start with a ds watch command producing editor-readable diagnostics, plus the CLI in the existing development/check scripts. A dedicated editor extension is optional later. Any live checker should eventually inspect unsaved buffers if it promises feedback before save.

## Agent workflows

Keep a short repository instruction pointing agents to the workflow whenever they install, edit, update, or assess a tracked design-system component. The deterministic engine supplies facts; the skill supplies the procedure.

Start with one model-discoverable design-system skill with these branches:

1. Use or install: inspect local inventory, find relevant registry items, consult version-specific examples, install through the tracked installer, and verify recorded files/dependencies.
2. Modify: inspect existing changes, make the requested edit, run applicable tests, record the actual reason when intent is known, and report what remains local. Preserve existing local work.
3. Update: identify the exact target, compute its dependency closure, preview the merge, resolve conflicts with the existing customization in view, and verify the resulting installation.
4. Contribute: isolate the component change, map it to upstream paths, remove project-only assumptions, include a reproduction or regression test, and prepare the contribution artifact.

Completion criteria: every changed tracked file is accounted for; applicable checks are recorded; provenance is preserved; unresolved issues remain explicit. An agent must not redefine the baseline or weaken policy merely to make a check pass.

The skill should not duplicate component API documentation or the entire CLI manual. Fetch relevant component/version documentation on demand.

## MCP

Reuse shadcn MCP for registry discovery. Route governed installations through the company CLI or its adapter so every path records provenance. A bypassed installation should be reported as untracked; do not reconstruct authoritative provenance by guesswork.

Add a custom MCP only if agents need structured access beyond shell commands or if client coverage makes it useful. Suggested tools: ds_status, ds_diff, ds_check, ds_plan_update, ds_prepare_contribution. Resources: component API documentation, release notes, compatibility rules, and examples for the installed revision.

MCP defines tools for callable operations and resources for contextual data. It does not enforce that an agent calls them. CI remains the common enforcement point. [MCP server concepts](https://modelcontextprotocol.io/docs/learn/server-concepts).

Local stdio is a sensible initial transport for reading a checkout. A hosted MCP cannot inspect uncommitted local changes without a local bridge or explicitly supplied data. Future apply/update tools should check the working-file fingerprints captured by the plan and refuse stale plans rather than overwrite intervening edits.

## Updates and upstream contribution

Use three inputs for updates: the old installed baseline, the local working copy, and the new upstream revision transformed for the target project. A standard three-way merge can identify textual conflicts; no textual conflict does not establish behavioral compatibility. Changes to installer configuration require explicit treatment. [git merge-file](https://git-scm.com/docs/git-merge-file).

A prepared upstream patch must account for installed-path and import rewrites. Reverse transformation may be ambiguous, so the tool can construct a reviewable patch against upstream and identify areas needing author work.

Automated issue/PR creation should occur on an explicit contribution intent or an adopted repository policy, not every keystroke. Deduplicate using repository, component, upstream revision, and patch fingerprint. Create or update one contribution record. GitHub operations in this environment use gh.

Keep submission status separate from technical facts and AI suggestions. An agent may suggest that a local fix belongs upstream; it cannot deterministically prove that architectural judgment.

## Behavioral assurance

A checksum detects a change. It does not judge its correctness. Use TypeScript for API compatibility, existing component tests for behavior, and targeted host-plus-remote browser tests for shared runtime and styles. If Storybook is already used, reuse stories and its accessibility testing. Playwright can exercise keyboard interactions and run axe scans; automated scans cover only part of accessibility. [Storybook accessibility](https://storybook.js.org/docs/writing-tests/accessibility-testing), [Playwright accessibility](https://playwright.dev/docs/accessibility-testing).

## Delivery order and acceptance evidence

1. Manifest, baseline capture, status/diff/check, text and JSON output. Demonstrate alias/format transformations do not appear as customization.
2. Intent records and CI. Demonstrate an acknowledged patch stays visible and additional edits are detected.
3. Agent skill and editor integration. Demonstrate the same diagnostic evidence appears for developer and agent.
4. Version metadata, update planner, and contribution preparation. Demonstrate local changes survive a nonconflicting update and conflicts are surfaced.
5. Optional MCP and fleet reporting. Add only when the first workflows are being used.

Other essential fixtures: missing tracked file, shared utility changed by two components, unknown legacy provenance, registry offline, CSS/config changes, unsupported dependency closure, stale update plan, and metadata changes under lint caching.

No tool, MCP server, lint plugin, or CI workflow was installed during this research.
