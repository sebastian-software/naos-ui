import { readFile } from "node:fs/promises"
import { expect, test } from "@playwright/test"
import { NaosResourceCache, fetchResource } from "../../../packages/data/dist/index.mjs"
import {
  renderDeclarativeShadowDom,
  transformComponent,
} from "../../../packages/compiler/dist/index.mjs"
import { renderApp } from "../../../packages/router/dist/index.mjs"

test("restores a server route and its declarative shadow root", async ({ page, baseURL }) => {
  const source = `export function ProfilePage({ name = "default" }: { name?: string } = {}) { return <p>{name}</p> }`
  const filename = "profile.wc.tsx"
  const compiled = transformComponent({ filename, source })
  const tag = compiled.tagName
  const routes = (cache: NaosResourceCache) => [
    {
      path: "/snapshot-demo",
      tag,
      async loader() {
        const resource = fetchResource("profile", async () => "Ada", { cache })
        const data = await resource.refetch!()
        resource.dispose()
        return data
      },
    },
  ]
  const result = await renderApp({
    request: new Request(`${baseURL}/snapshot-demo`),
    Cache: NaosResourceCache,
    routes,
    expiresAt: Date.now() + 60_000,
    actionData: { saved: true },
    render: ({ data }) =>
      renderDeclarativeShadowDom({ filename, source, props: { name: data } }).html,
  })
  const routerJs = await readFile(
    new URL("../../../packages/router/dist/index.mjs", import.meta.url),
    "utf8",
  )
  const dataJs = await readFile(
    new URL("../../../packages/data/dist/index.mjs", import.meta.url),
    "utf8",
  )
  const runtimeJs = await readFile(
    new URL("../../../packages/runtime/dist/internal.mjs", import.meta.url),
    "utf8",
  )
  const runtimeChunk = runtimeJs.match(/from "\.\/(runtime-[^"]+\.mjs)"/)?.[1]
  if (!runtimeChunk) throw new Error("Missing runtime shared chunk")
  const runtimeChunkJs = await readFile(
    new URL(`../../../packages/runtime/dist/${runtimeChunk}`, import.meta.url),
    "utf8",
  )
  await page.route(`**/${runtimeChunk}`, (route) =>
    route.fulfill({ contentType: "text/javascript", body: runtimeChunkJs }),
  )
  await page.route("**/snapshot-runtime.mjs", (route) =>
    route.fulfill({ contentType: "text/javascript", body: runtimeJs }),
  )
  await page.route("**/snapshot-component.mjs", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: compiled.code.replace("@naos-ui/runtime/internal", "/snapshot-runtime.mjs"),
    }),
  )
  await page.route("**/snapshot-router.mjs", (route) =>
    route.fulfill({ contentType: "text/javascript", body: routerJs }),
  )
  await page.route("**/snapshot-data.mjs", (route) =>
    route.fulfill({ contentType: "text/javascript", body: dataJs }),
  )
  await page.route("**/snapshot-demo", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `
    <main>${result.html}</main><script type="application/json" id="snapshot">${result.serializedSnapshot}</script>
    <script>window.originalHost = document.querySelector('${tag}'); window.originalNode = window.originalHost.shadowRoot.querySelector('p')</script>
    <script type="module">
      import { createRouter } from '/snapshot-router.mjs';
      import { NaosResourceCache, fetchResource } from '/snapshot-data.mjs';
      const cache = new NaosResourceCache();
      window.fetches = 0;
      const routes = [{ path: '/snapshot-demo', tag: '${tag}',
        loader: () => { window.fetches++; return 'wrong'; },
        props: ({ data }) => ({ name: data }),
        load: async () => { await import('/snapshot-component.mjs'); const resource = fetchResource('profile', () => { window.fetches++; return 'wrong'; }, { cache }); resource.subscribe(() => {}); }
      }];
      const router = createRouter({ outlet: document.querySelector('main'), routes, snapshot: document.querySelector('#snapshot').textContent, snapshotCache: cache });
      router.addEventListener('naos:routechange', () => { window.match = router.currentMatch; window.ready = true; });
      router.start();
    </script>`,
    }),
  )
  await page.goto("/snapshot-demo")
  await page.waitForFunction(() => (window as unknown as { ready: boolean }).ready)
  expect(
    await page.evaluate((tagName) => {
      const state = window as unknown as {
        originalHost: Element
        originalNode: Element
        fetches: number
        match: { data: unknown; actionData: unknown }
      }
      return {
        same: state.originalHost === document.querySelector(tagName),
        shadow: state.originalHost.shadowRoot?.querySelector("p")?.textContent,
        sameNode: state.originalNode === state.originalHost.shadowRoot?.querySelector("p"),
        fetches: state.fetches,
        data: state.match.data,
        actionData: state.match.actionData,
      }
    }, tag),
  ).toEqual({
    sameNode: true,
    same: true,
    shadow: "Ada",
    fetches: 0,
    data: "Ada",
    actionData: { saved: true },
  })
})
