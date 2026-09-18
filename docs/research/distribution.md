# Design-system distribution for React microfrontends

Research date: September 18, 2026.

Recommendation: retain the existing shadcn registry during the microfrontend transition if consumer ownership and adaptation are intended. Do not migrate the whole library solely because a shared host is being introduced. Prefer package distribution for centrally maintained components when teams should consume their behavior unchanged and rapid, auditable upgrades matter more than editing their source.

This is an architectural recommendation based on the supplied context and official documentation, not a review of the company's implementation. The host is confirmed to use Module Federation in the same page. Consumer customization and contribution are intended benefits of registry distribution. The bundler/plugin, Tailwind version, React root arrangement, and existing npm usage remain unconfirmed. See the [Module Federation evaluation plan](../../plans/1789755844--9-18-2:24pm--evaluate-module-federation-integration.md).

## Separate the decisions

Distribution puts source or package artifacts in each repository. Runtime composition decides which JavaScript instances the browser loads. Ownership determines who maintains changes after installation. pnpm is compatible with either distribution approach.

Webpack distinguishes local modules from remote modules loaded at runtime. Module Federation provides explicit shared dependency configuration. Therefore installing the same package in multiple builds does not establish a shared runtime instance. [Webpack](https://webpack.js.org/concepts/module-federation/), [Module Federation](https://module-federation.io/configure/shared).

## Comparison

| Concern | Source registry | Versioned package |
| --- | --- | --- |
| Inspecting and adapting code | Files live directly in the consuming repository | Source can be shipped, but normal use favors the published API |
| Consumer ownership | Easy to make changes; consumer must maintain those changes | Upstream owns implementation; customization uses APIs, wrappers, or deliberate patches |
| Shared fixes | Apply source updates and reconcile local modifications | Upgrade a release and validate consumer integration |
| Versions | Versioned registry endpoints and committed source; provenance and update automation need explicit design | Package version and lockfile identify installed artifacts |
| Granularity | Install individual items and their dependencies | Subpath exports and tree shaking can avoid unused browser code; independent component versions require separate release units |
| Private distribution | Authenticated registry hosting replaces private package publishing for copied files | Registry credentials and publishing pipeline remain |
| Dependencies | Installed source still depends on compatible framework and library versions | Peer dependencies and build outputs define compatibility, but cannot guarantee it |
| Browser duplication | Copied component code is normally bundled in each application | Package code can also be bundled per application; runtime sharing is a separate choice |
| Deployment | Consumers ship their installed copies independently | Consumers can pin versions and deploy independently |
| Governance cost | Track source provenance, modifications, compatibility, and adoption | Track package adoption, API compatibility, and release quality |

These tradeoffs are engineering judgments. Source mechanics are documented by [shadcn's registry introduction](https://ui.shadcn.com/docs/registry). Package inclusion is configurable through [npm package files](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#files), and browser elimination of unused exports depends on the build and side effects, as explained by [webpack's tree-shaking guide](https://webpack.js.org/guides/tree-shaking/).

## Corrections to common arguments

Registry distribution removes the private package dependency for the files it copies. It does not remove external npm dependencies: registry items explicitly declare package dependencies and other registry items. [Registry item schema](https://ui.shadcn.com/docs/registry/registry-item-json).

Registries can be private and versioned. shadcn documents authenticated requests and version selection through registry endpoints. Its CLI can preview changes and show diffs. Those features do not automatically reconcile locally changed components or provide a company-wide adoption inventory. [Namespaces](https://ui.shadcn.com/docs/registry/namespace), [CLI](https://ui.shadcn.com/docs/cli).

Source visibility is a valid workflow advantage, but package contents do not have to be minified or opaque. Readable outputs, source files, type declarations, source maps, and linked documentation can improve the package experience. This is a packaging choice.

Neither a package release nor a registry publication patches already deployed build-time consumers. Teams still need to update, test, and deploy. A host-controlled runtime dependency can change centrally, but introduces a different release contract and shared failure risk.

## What the shared host changes

1. **React compatibility.** For components rendered by the same React renderer, imports must resolve to the compatible React instance. Keep React external to any library bundle and declare the appropriate peer dependencies. Configure sharing in the selected host integration and test actual resolution. Separate isolated applications can use separate React copies; multiple copies on a page are not categorically invalid. [React troubleshooting](https://react.dev/warnings/invalid-hook-call-warning).

2. **Context identity.** Two copies of a module that each call createContext produce distinct objects. Matching source or version numbers do not fix that. A provider and consumer must reference the same object and belong to the appropriate React tree. Separate roots need explicit communication or separately configured providers. [React useContext](https://react.dev/reference/react/useContext).

3. **Global CSS.** For a shared document, assign the shell ownership of resets, fonts, and the active semantic token values. Scope microfrontend styles and define which token versions remain compatible. Do not let remote mount order choose the global theme. This follows the shared-versus-local CSS distinction in [single-spa's CSS guidance](https://single-spa.js.org/docs/ecosystem-css/).

4. **Tailwind generation.** A host build cannot discover arbitrary class names in future separately deployed remote bundles. Remotes need to deliver their required utility styles, or consume a deliberately complete compatible stylesheet. Current Tailwind excludes node_modules from automatic scanning and supports explicit sources. A packaged library can ship CSS or document consumer scanning. [Tailwind source detection](https://tailwindcss.com/docs/detecting-classes-in-source-files).

5. **Reset and selector collisions.** For Tailwind v4, Preflight is a separate import that can be omitted; v3 configuration differs. Establish a version/configuration contract and use appropriate prefixes or scoping for independent outputs. Namespacing does not remove every global interaction. [Tailwind Preflight](https://tailwindcss.com/docs/preflight).

6. **Portals and overlays.** Test styles, token inheritance, focus restoration, scroll locking, and stacking when two remotes open dialogs. If Radix remains in use, its Dialog portal defaults to document.body and accepts a custom container. Container-scoped themes can therefore be lost unless the portal destination participates in the theme. [Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog).

My inference: these integration contracts are more urgent than changing distribution. Both distribution choices need them.

## Tactical recommendation

Keep one canonical component implementation and the existing registry for the transition. Make the shell's token and base-style release explicit and immutable. Adopt a small shared package or runtime module only where shared context identity or a platform service requires it; publishing a package alone does not ensure singleton loading.

Do not expose the entire design system as a host singleton by default. Measure repeated JavaScript and CSS before increasing runtime coupling. Small duplicated components may cost less than a globally coordinated upgrade. The [single-spa recommended setup](https://single-spa.js.org/docs/recommended-setup/#shared-dependencies) discusses the coordination cost of sharing dependencies.

For registry governance, record the installed upstream revision and local modifications, pin registry artifacts and CLI versions, maintain a compatibility matrix, and deliver updates as reviewable source changes. These are proposed company practices, not automatic shadcn features.

If consumers are not supposed to edit standard buttons, inputs, and dialogs, favor a package for that core and retain the registry for editable compositions and examples. Avoid maintaining duplicate hand-edited implementations across both channels.

A useful decision test is an accessibility fix to a dialog after several teams have changed its implementation. If the organization expects the central design-system team to apply one supported fix everywhere, packages fit that responsibility better. If product teams intentionally own adaptations and accept merging upstream changes, the registry fits better.

## Validation before migration

Use a host and two independently built remotes. Install the current design system in both, deliberately keep one on the previous supported component revision, and change mount order. Exercise theme changes, dialogs, menus, a shared provider where applicable, standalone development, remote rollback, and a source update with one local modification.

Measure compressed JavaScript/CSS, loading and interaction behavior, update effort, and rollback independence. Compare a package build of only the relevant components if the registry experiment exposes a specific problem. No benchmark or implementation test was run during this research.
