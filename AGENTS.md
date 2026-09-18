# Working on this prototype

Read README.md for the implemented scope. docs/research/tooling.md describes proposed capabilities; it is not an implementation reference.

Run pnpm check after changing the tracking engine or CLI. Run pnpm demo when changing the shadcn adapter; it uses the network and creates a new disposable consumer under .lab/.

When editing a tracked demo component, inspect it with pnpm --silent ds status and ds diff using --cwd. Record an intentional customization with ds record and a specific reason. Preserve the original installed baseline. Checks must remain independent of whether an agent follows these instructions.

Keep generated consumers and node_modules out of commits. .lab/ contains installation snapshots and scratch source for the experiment.

Use gh for GitHub operations and work on a feature branch. Commit and push finished, checked changes in small Conventional Commit groups.
