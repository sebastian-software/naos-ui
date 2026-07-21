# Changelog

## [1.1.0](https://github.com/sebastian-software/naos-ui/compare/naos-ui-v1.0.0...naos-ui-v1.1.0) (2026-07-21)


### Features

* **actions:** component-local action primitives with native form enhancement ([#154](https://github.com/sebastian-software/naos-ui/issues/154)) ([004b950](https://github.com/sebastian-software/naos-ui/commit/004b950602d098182c5405714e7e21d09ee2e8a6)), closes [#72](https://github.com/sebastian-software/naos-ui/issues/72)
* **compiler:** @naos-ui/compiler-wasm opt-in WebAssembly fallback tier ([#167](https://github.com/sebastian-software/naos-ui/issues/167)) ([00d507a](https://github.com/sebastian-software/naos-ui/commit/00d507ae9a7aeb91f81df2b1c478e748fad92b7a))
* **compiler:** add template DOM backend ([19a20ab](https://github.com/sebastian-software/naos-ui/commit/19a20ab22daf207c0a087566cf6c35ca406a3116))
* **compiler:** clx class helper and style-object CSS custom properties ([#159](https://github.com/sebastian-software/naos-ui/issues/159)) ([f962c6e](https://github.com/sebastian-software/naos-ui/commit/f962c6e94191fd8daa2c3ba7b289a5f2cee7da03))
* **compiler:** derive prop kinds from TypeScript types; add rich property-only props ([#151](https://github.com/sebastian-software/naos-ui/issues/151)) ([67c1756](https://github.com/sebastian-software/naos-ui/commit/67c17560defadb9cb206bdee0c52628c3ed99116)), closes [#104](https://github.com/sebastian-software/naos-ui/issues/104)
* **compiler:** dev-only reactive tracing with inspect() ([#161](https://github.com/sebastian-software/naos-ui/issues/161)) ([3b15483](https://github.com/sebastian-software/naos-ui/commit/3b15483b8dce0740ad4c06ed62445e7826ab3508))
* **compiler:** emit typed element declarations for compiled components ([#152](https://github.com/sebastian-software/naos-ui/issues/152)) ([956a758](https://github.com/sebastian-software/naos-ui/commit/956a7585abdcf62d6da7ffc04c80d1ada23246be)), closes [#107](https://github.com/sebastian-software/naos-ui/issues/107)
* **compiler:** share component CSS via one constructable stylesheet ([#149](https://github.com/sebastian-software/naos-ui/issues/149)) ([83b4258](https://github.com/sebastian-software/naos-ui/commit/83b42582a2bc4f815deb6d2f632eab20a0b1e073)), closes [#105](https://github.com/sebastian-software/naos-ui/issues/105)
* **compiler:** source spans, line/column, and code frames for diagnostics ([#145](https://github.com/sebastian-software/naos-ui/issues/145)) ([faeb0fd](https://github.com/sebastian-software/naos-ui/commit/faeb0fd3d0c676f326866291acb50069d7b0fecd)), closes [#97](https://github.com/sebastian-software/naos-ui/issues/97)
* **create-naos:** npm create starter for zero-to-component setup ([#156](https://github.com/sebastian-software/naos-ui/issues/156)) ([5010509](https://github.com/sebastian-software/naos-ui/commit/5010509e4ce7c7d9190d02fcb00a50e13b6a1794)), closes [#120](https://github.com/sebastian-software/naos-ui/issues/120)
* **data:** lifecycle binding, lazy start, fetching flag, retry, optimistic Convex ([#148](https://github.com/sebastian-software/naos-ui/issues/148)) ([aa85795](https://github.com/sebastian-software/naos-ui/commit/aa85795381848a0ef0666be473333ea4f71ccedd)), closes [#110](https://github.com/sebastian-software/naos-ui/issues/110)
* **docs:** browser compiler playground powered by a WASM naos-core build ([#166](https://github.com/sebastian-software/naos-ui/issues/166)) ([440cbaf](https://github.com/sebastian-software/naos-ui/commit/440cbafc919009cd19db50468ba47732ae396098))
* **docs:** playground redesign with CodeMirror editor and shiki output ([#168](https://github.com/sebastian-software/naos-ui/issues/168)) ([d351118](https://github.com/sebastian-software/naos-ui/commit/d35111851d951ce2b3f6df3c8175035aad8f61ab))
* **docs:** redesign homepage with hero, pipeline, and feature sections ([071db7b](https://github.com/sebastian-software/naos-ui/commit/071db7b821de1db89abfe09d5483984506486545))
* **examples:** tasks app exercising router, data, and motion together ([#147](https://github.com/sebastian-software/naos-ui/issues/147)) ([50d609c](https://github.com/sebastian-software/naos-ui/commit/50d609c4e4d6ba8c679aadcb0b3406817ddf3e86)), closes [#113](https://github.com/sebastian-software/naos-ui/issues/113)
* **motion:** autoLayout helper for automatic direct-child layout motion ([#160](https://github.com/sebastian-software/naos-ui/issues/160)) ([3be3507](https://github.com/sebastian-software/naos-ui/commit/3be3507d013686996ab119f55ede65868876cce5))
* **playground:** standalone site with a curated example gallery ([#169](https://github.com/sebastian-software/naos-ui/issues/169)) ([8fc7e59](https://github.com/sebastian-software/naos-ui/commit/8fc7e594c80cb2dcc67156f1936d8f07fd3653d9))
* **router:** nested layout routes with explicit child outlets and route metadata ([#153](https://github.com/sebastian-software/naos-ui/issues/153)) ([741c289](https://github.com/sebastian-software/naos-ui/commit/741c28926732553bcd89fad997cfc3c7749be008)), closes [#71](https://github.com/sebastian-software/naos-ui/issues/71) [#112](https://github.com/sebastian-software/naos-ui/issues/112)
* **router:** prefetch data reuse, link prefetch UX, transition state, error URLs ([#150](https://github.com/sebastian-software/naos-ui/issues/150)) ([2109c96](https://github.com/sebastian-software/naos-ui/commit/2109c968de967202d82fad6111233cde2e353272))
* **router:** thread typed path params through loaders, actions, and matches ([#143](https://github.com/sebastian-software/naos-ui/issues/143)) ([c8d4245](https://github.com/sebastian-software/naos-ui/commit/c8d424518c3d6bbd8a5f122800281976f2d78512)), closes [#111](https://github.com/sebastian-software/naos-ui/issues/111)
* **runtime:** add shared runtime kernel ([4188a3c](https://github.com/sebastian-software/naos-ui/commit/4188a3cef06b4ebea6f896e626024e3512320178))
* **testing:** ship @naos-ui/testing mount/flush/inspect harness ([#146](https://github.com/sebastian-software/naos-ui/issues/146)) ([3d60c00](https://github.com/sebastian-software/naos-ui/commit/3d60c00a24d0c8827ea784542fc54f0513392b39)), closes [#108](https://github.com/sebastian-software/naos-ui/issues/108)
* **unplugin:** bundler-agnostic component transform for Rollup, esbuild, webpack, and Rspack ([#157](https://github.com/sebastian-software/naos-ui/issues/157)) ([562eb6f](https://github.com/sebastian-software/naos-ui/commit/562eb6fe26e938fe78c88218e9677feb4ed33e05)), closes [#119](https://github.com/sebastian-software/naos-ui/issues/119)
* **vite:** full-reload hot update for compiled components ([#141](https://github.com/sebastian-software/naos-ui/issues/141)) ([2d907d5](https://github.com/sebastian-software/naos-ui/commit/2d907d554a662e6bc0fbd73081c5b1b6a46d8587))


### Bug Fixes

* **ci:** update runtime kernel expectations ([2d870a8](https://github.com/sebastian-software/naos-ui/commit/2d870a8b3d72cec962ca170a4dc25395ab26a209))
* **compiler:** address template backend review feedback ([c2d3a07](https://github.com/sebastian-software/naos-ui/commit/c2d3a078038958a6e6fe48f41713f4c06fdeea17))
* **compiler:** emit authored source mappings ([0905b80](https://github.com/sebastian-software/naos-ui/commit/0905b80c20301697d76eb0e7c99dda66db096118))
* **compiler:** hide inactive control-flow branches ([8c78d1f](https://github.com/sebastian-software/naos-ui/commit/8c78d1fd24bf12e73cbd9c7acf7a0d48680a02ee))
* **data:** evict idle resource cache entries ([#138](https://github.com/sebastian-software/naos-ui/issues/138)) ([b6d2046](https://github.com/sebastian-software/naos-ui/commit/b6d2046c42ba2aa541c0d718b0394c63713354b6)), closes [#109](https://github.com/sebastian-software/naos-ui/issues/109)
* **docs:** guard clipboard access in homepage install command ([37838ed](https://github.com/sebastian-software/naos-ui/commit/37838edcf3d421cc44adbe262965d3d0d2e5c0d3))
* **playground:** resolve internal runtime import ([ad8e337](https://github.com/sebastian-software/naos-ui/commit/ad8e3372a1c8555f6e0687595ccd577e09b43a98))
* **release:** publish packages from one product release ([c974986](https://github.com/sebastian-software/naos-ui/commit/c974986dfbe175ee27753dc7ea1ec6aa9dfe7f1a))
* **runtime:** address shared kernel review ([3c4424b](https://github.com/sebastian-software/naos-ui/commit/3c4424b9365342499b2978fba2918c1e7244957f))
* **runtime:** harden disconnect scheduling ([24835fa](https://github.com/sebastian-software/naos-ui/commit/24835fac21b596d3da63256f21d5be64922561cd))
* **runtime:** normalize compound spread events ([a75429e](https://github.com/sebastian-software/naos-ui/commit/a75429e97c39f5705f690a829e50476886cd6c1d))
* **runtime:** recover from update errors ([bf2ec76](https://github.com/sebastian-software/naos-ui/commit/bf2ec7645c4cc8e7f4358ba23bd5137b422faf49))
* **runtime:** restart effects after reconnect ([439fa04](https://github.com/sebastian-software/naos-ui/commit/439fa04515e640d9d448f88f13f5e899bcb25332))
* **runtime:** satisfy lint warnings ([ca581fb](https://github.com/sebastian-software/naos-ui/commit/ca581fb61eeb56c230b664c33c5ae0dfd40794c7))
* **signals:** skip equal state writes ([c7fc46b](https://github.com/sebastian-software/naos-ui/commit/c7fc46b448198d60be484fa54fa629bd43d72bb7))
* **tooling:** align fresh project with stable tags ([b782633](https://github.com/sebastian-software/naos-ui/commit/b78263360b5ccf6bd64ba6d86939e9ce15e2b7e4))
* **vite:** dev-mode correctness for inline styles and hasChanged ([#142](https://github.com/sebastian-software/naos-ui/issues/142)) ([2c9a85b](https://github.com/sebastian-software/naos-ui/commit/2c9a85be679eae0fb6141090f3f1ac2f74d20358)), closes [#101](https://github.com/sebastian-software/naos-ui/issues/101)
