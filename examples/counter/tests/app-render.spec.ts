import { readFile } from "node:fs/promises"
import { expect, test } from "@playwright/test"
import { NaosResourceCache, fetchResource } from "../../../packages/data/dist/index.mjs"
import { renderApp } from "../../../packages/router/dist/index.mjs"

test("restores a server route and its declarative shadow root", async ({ page, baseURL }) => {
  const routes = (cache: NaosResourceCache) => [
    {
      path: "/snapshot-demo",
      tag: "snapshot-page",
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
      `<snapshot-page><template shadowrootmode="open"><p>${data}</p></template></snapshot-page>`,
  })
  const routerJs = await readFile(
    new URL("../../../packages/router/dist/index.mjs", import.meta.url),
    "utf8",
  )
  const dataJs = await readFile(
    new URL("../../../packages/data/dist/index.mjs", import.meta.url),
    "utf8",
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
    <script>window.originalHost = document.querySelector('snapshot-page')</script>
    <script type="module">
      import { createRouter } from '/snapshot-router.mjs';
      import { NaosResourceCache, fetchResource } from '/snapshot-data.mjs';
      const cache = new NaosResourceCache();
      window.fetches = 0;
      const routes = [{ path: '/snapshot-demo', tag: 'snapshot-page',
        loader: () => { window.fetches++; return 'wrong'; },
        load: () => customElements.define('snapshot-page', class extends HTMLElement {
          connectedCallback() { const resource = fetchResource('profile', () => { window.fetches++; return 'wrong'; }, { cache }); resource.subscribe(() => {}); }
        })
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
    await page.evaluate(() => {
      const state = window as unknown as {
        originalHost: Element
        fetches: number
        match: { data: unknown; actionData: unknown }
      }
      return {
        same: state.originalHost === document.querySelector("snapshot-page"),
        shadow: state.originalHost.shadowRoot?.textContent,
        fetches: state.fetches,
        data: state.match.data,
        actionData: state.match.actionData,
      }
    }),
  ).toEqual({ same: true, shadow: "Ada", fetches: 0, data: "Ada", actionData: { saved: true } })
})
