# Evaluate Module Federation integration

Confirmed context: the host loads React microfrontends through Module Federation in the same page. Consumers may customize component implementations. The recommendation remains registry distribution with explicit runtime and CSS contracts.

This plan is proposed work, not an implemented host. The bundler/plugin, React/Tailwind versions, and whether remotes render beneath the host's React root remain open. Existing npm usage is being clarified.

1. Select the concrete federation adapter and document the React boundary.
   Configure compatible React and React DOM sharing for the chosen plugin. Verify actual imported entry points, including JSX runtimes and react-dom/client where used, rather than assuming a root package key covers every import. Assert the resolved runtime identity in the integration fixture. [Module Federation shared configuration](https://module-federation.io/configure/shared).

2. Keep independently customizable components local to each remote.
   Start with one host and two separately built remotes that consume distinct supported button revisions. Do not register consumer-customized components as shared singleton modules. Demonstrate that one remote's modification does not replace the other's implementation.

3. Establish CSS ownership and delivery.
   Let the host own agreed reset, fonts, and semantic token values. Have each remote deliver its required component/utility styles with appropriate scoping or prefixes. Reverse load order and verify stable appearance. Federation's module sharing does not itself isolate CSS. [Module Federation style isolation](https://module-federation.io/guide/basic/css-isolate).

4. Test provider and portal boundaries.
   Where provider values cross the boundary, use the same context object and the appropriate React tree. A shared dependency does not bridge independent roots automatically. Exercise dialogs, portal destinations, theme inheritance, focus restoration, and overlays while both remotes are mounted. [React context](https://react.dev/reference/react/useContext).

5. Connect the tracking CLI to integration evidence.
   Preserve source revisions and customization records per remote. Add deterministic checks for declared compatibility constraints, then browser tests for runtime behavior. Keep unsupported or untested combinations explicit.

6. Exercise independent delivery.
   Update or roll back one remote while the host and other remote remain deployed. Test mismatched declared runtime requirements and unavailable remote assets. Measure duplicated JavaScript and CSS before expanding the shared dependency list.

Expected outcome: evidence that component independence survives same-page federation, with a documented host/remote contract. No change to package distribution is justified solely by choosing Module Federation.
