# npm Publishing

This runbook prepares the first public npm publish for the Naos package set.
Use it when bootstrapping the `@naos-ui` packages and when validating later
manual release runs.

## Package Set

The public npm release set is generated from `scripts/release-set.mjs` and
verified by `pnpm check-release-set`:

<!-- release-set:start -->
| npm package | Workspace path |
| --- | --- |
| `@naos-ui/core` | `packages/core` |
| `@naos-ui/actions` | `packages/actions` |
| `@naos-ui/data` | `packages/data` |
| `@naos-ui/data-convex` | `packages/data-convex` |
| `@naos-ui/motion` | `packages/motion` |
| `@naos-ui/runtime` | `packages/runtime` |
| `@naos-ui/primitives` | `packages/primitives` |
| `@naos-ui/router` | `packages/router` |
| `@naos-ui/testing` | `packages/testing` |
| `@naos-ui/compiler` | `packages/compiler` |
| `@naos-ui/compiler-wasm` | `packages/compiler-wasm` |
| `@naos-ui/vite` | `packages/vite` |
| `@naos-ui/unplugin` | `packages/unplugin` |
| `@naos-ui/cli` | `packages/cli` |
| `create-naos` | `packages/create-naos` |
| `@naos-ui/compiler-linux-x64-gnu` | `packages/compiler-linux-x64-gnu` |
| `@naos-ui/compiler-linux-arm64-gnu` | `packages/compiler-linux-arm64-gnu` |
| `@naos-ui/compiler-linux-x64-musl` | `packages/compiler-linux-x64-musl` |
| `@naos-ui/compiler-linux-arm64-musl` | `packages/compiler-linux-arm64-musl` |
| `@naos-ui/compiler-darwin-x64` | `packages/compiler-darwin-x64` |
| `@naos-ui/compiler-darwin-arm64` | `packages/compiler-darwin-arm64` |
| `@naos-ui/compiler-win32-x64-msvc` | `packages/compiler-win32-x64-msvc` |
| `@naos-ui/compiler-win32-arm64-msvc` | `packages/compiler-win32-arm64-msvc` |
<!-- release-set:end -->

The native packages must be published before `@naos-ui/compiler`, because
`@naos-ui/compiler` declares them as optional dependencies.

## First Publish

The first publish is the bootstrap step that makes package settings available
on npmjs.com. After that, configure Trusted Publishing for every package.

Do the first publish from GitHub Actions, not from a local machine. A local
machine can only build its host-native package, while the release workflow
builds the complete native matrix on the matching hosted runners.

Prerequisites:

* The npm organization `naos-ui` exists.
* The publisher is an owner of the `naos-ui` npm organization.
* The GitHub repository is public.
* The GitHub repository has a temporary `NPM_TOKEN` secret with publish access.
  Use a granular access token with read/write access for the `naos` scope and
  `Bypass 2FA` enabled for this bootstrap run. GitHub Actions cannot answer an
  interactive one-time-password prompt during the native matrix publish.
* The release workflow uses GitHub-hosted runners, `id-token: write`, and Node
  `22.18.0` or newer.

Local preflight:

```sh
npm whoami
npm org ls naos-ui
pnpm install --frozen-lockfile
pnpm check-release-set
pnpm check-native-types
pnpm build
pnpm check
pnpm test
```

JavaScript-package preflight:

```sh
while IFS= read -r package_path; do
  (cd "$package_path" && npm pack --dry-run --json)
done < <(node scripts/release-set.mjs --js-paths)
```

For native packages, only dry-run the package that matches the current host
unless the `.node` artifact for that package was built in the same environment.
The release workflow performs the full native package dry-run and publish on
the target runners.

Manual workflow sequence:

1. Dispatch `.github/workflows/release.yml` with `dry_run=true`.
2. Confirm every native package builds, smoke-tests, and dry-runs first.
3. Confirm the JavaScript package job verifies, builds, and dry-runs after the
   native matrix.
4. Dispatch the same workflow with `dry_run=false`.
5. Verify all packages exist on npm with version `0.0.0`.

Do not rerun `dry_run=false` for the same version. npm versions are immutable.

After the first publish, delete the temporary `NPM_TOKEN` repository secret and
revoke the npm token unless another bootstrap run is still required.

## Trusted Publishing Setup

After the first publish, configure a Trusted Publisher on npmjs.com for each
package:

* Provider: GitHub Actions
* Organization or user: `sebastian-software`
* Repository: `naos-ui`
* Workflow filename: `release.yml`
* Allowed actions: `npm publish`
* Environment name: empty, unless the release workflow starts using a protected
  GitHub environment

After Trusted Publishing is configured and a publish has been verified through
OIDC, remove the temporary publish token and restrict token publishing in npm
package settings.

## Notes

The workflow keeps `--provenance` on publish commands. npm also generates
provenance automatically for public packages published from public GitHub
repositories through Trusted Publishing.

If a publish fails with authentication errors, check the exact workflow filename
configured on npmjs.com, the `id-token: write` permission, and that the workflow
is running on GitHub-hosted runners.
