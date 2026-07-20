# Contributing to Naos

Thanks for contributing! This guide covers setup (including a Rust-free path),
the command vocabulary, and the conventions CI enforces.

## Prerequisites

- Node.js ≥ 22
- pnpm 11.6.0 (pinned via `packageManager`; `corepack enable` activates it)
- Rust stable — only for compiler work and `pnpm build:native`; see the
  JS-only workflow below for everything else

The fastest zero-setup path is the devcontainer (`.devcontainer/`), which pins
all three and runs `pnpm install` plus `pnpm build:native` on create — a fresh
clone can run `pnpm check` immediately. It works locally and in GitHub
Codespaces.

## Full Setup

```sh
pnpm install
pnpm build:native   # builds the Rust compiler binding (needs Rust stable)
pnpm check
pnpm test
```

`build:native` copies the binding into `packages/compiler/native/` and keeps
the current platform package in sync, since the native loader prefers the
platform package when present.

## JS-Only Workflow (no Rust toolchain)

TypeScript, docs, and example contributors can skip Rust entirely:

```sh
pnpm install
pnpm fetch:native   # installs a prebuilt compiler binding
pnpm check:js       # all JS/TS gates (no cargo)
pnpm test:packages  # all package test suites
```

`fetch:native` tries the published npm platform package first, then the
latest `native-binding-<OS>` CI artifact via an authenticated GitHub CLI
(`gh auth login`), and also accepts an explicit source with
`--from <naos-node.node | platform-package.tgz>`. The installed binding
matches its source release or CI run — if your change touches
`crates/`, you need the full setup so generated code and native types match
your sources.

## Command Vocabulary

| Command | What it covers |
| --- | --- |
| `pnpm check` | every static gate: API conventions, dependency boundaries, release set, native types, TypeScript, docs, Rust |
| `pnpm check:js` | the same gates without the Rust half |
| `pnpm test` | package test suites plus the Rust workspace tests |
| `pnpm test:packages` | package test suites only |
| `pnpm lint` | oxlint, Prettier check, clippy |
| `pnpm format` | write Prettier formatting |
| `pnpm build` | build every package |
| `pnpm verify:fresh-project` | scaffold with `create-naos`, install packed tarballs, build |

Browser tests live in the examples:
`pnpm --filter @naos-ui/example-counter test`.

## Commit and PR Conventions

- Commits follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat(scope): …`, `fix: …`, `build: …`, `docs: …`) — release-please derives
  versions and changelogs from them, so the type and scope matter.
- CI must be fully green; the Quality Gates job runs the same commands listed
  above.
- Dependency updates are managed by Renovate; please do not add Dependabot
  config or manual bump PRs.
- Public framework types use the `Naos` prefix (enforced by
  `check-api-conventions`), and foundation packages must not import outward
  layers (enforced by `check-dependency-boundaries`).

## Security

See [SECURITY.md](SECURITY.md) — report vulnerabilities privately via GitHub
Security Advisories, not public issues.
