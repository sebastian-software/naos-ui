# `create-naos`

Scaffold a Naos + Vite starter project with one command:

```sh
npm create naos@latest my-app
cd my-app
pnpm install
pnpm dev
```

The starter ships a pre-wired Vite project: `tsconfig.json` with the Naos JSX
settings (`jsx: "react-jsx"`, `jsxImportSource: "@naos-ui/core"`), the
`@naos-ui/vite` plugin, a sample `app-counter` component with styles and a
typed `change` event, an `@naos-ui/primitives` button, and `dev`/`build`/
`type-check` scripts.

Per ADR 0014 the `@naos-ui/cli` stays minimal (`compile`, `prerender`,
`info`); scaffolding lives in this separate package. The generated project is
verified by the repository's fresh-project CI check, which scaffolds with
this package, installs the freshly packed workspace tarballs, and builds the
result.
