# Prototype results

Verified September 18, 2026 with Node 24.13.1, pnpm 10.30.1, and shadcn 4.21.0.

The live demo fetched the official new-york-v4 button registry item and installed it using addRegistryItems from shadcn/registry. The consumer package manifest and lockfile were produced locally; the generated consumer is ignored by Git.

Observed transitions:

1. Immediately after installation, source was unchanged and no customization record was required.
2. Appending a local comment changed source status to modified and required a record.
3. Recording a reason preserved the installed baseline and left source status modified, with acknowledgement recorded.
4. A strict JSON check passed for that recorded customization.

Type checking and 12 offline tests passed. They cover transformed baselines, additional edits after acknowledgement, missing files, corrupt artifacts/baselines, path traversal, symbolic links, duplicate ownership, schema versions, and CLI exit codes.

Conclusion: the basic provenance and acknowledgement model works without an LLM. This experiment does not establish safe update merging, shared CSS tracking, runtime compatibility, or a complete upstream contribution workflow. Those remain separate experiments.
