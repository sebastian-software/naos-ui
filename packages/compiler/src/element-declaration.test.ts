import { describe, expect, it } from "vitest"

import { renderNaosElementDeclaration } from "./element-declaration.js"

describe("renderNaosElementDeclaration", () => {
  it("renders typed props, event overloads, and the global tag map", () => {
    const declaration = renderNaosElementDeclaration({
      className: "AcmeCardElement",
      exportName: "AcmeCard",
      tagName: "acme-card",
      props: [
        { propName: "title", attributeName: "title", kind: "string", defaultValue: "\"\"" },
        { propName: "count", attributeName: "count", kind: "number", defaultValue: "0" },
        { propName: "open", attributeName: "open", kind: "boolean", defaultValue: "false" },
        { propName: "items", attributeName: "items", kind: "rich", defaultValue: "undefined" },
      ],
      events: [{ eventName: "card-change", detailType: "{ open: boolean }" }],
    })

    expect(declaration).toContain("export declare class AcmeCardElement extends HTMLElement {")
    expect(declaration).toContain("  title: string;")
    expect(declaration).toContain("  count: number;")
    expect(declaration).toContain("  open: boolean;")
    expect(declaration).toContain("  items: unknown;")
    expect(declaration).toContain(
      "addEventListener<Type extends keyof AcmeCardElementEventMap>"
    )
    expect(declaration).toContain(
      "removeEventListener<Type extends keyof AcmeCardElementEventMap>"
    )
    expect(declaration).toContain(
      "export interface AcmeCardElementEventMap extends HTMLElementEventMap {"
    )
    expect(declaration).toContain("\"card-change\": CustomEvent<{ open: boolean }>;")
    expect(declaration).toContain("export { AcmeCardElement as AcmeCard };")
    expect(declaration).toContain("export default AcmeCardElement;")
    expect(declaration).toContain("\"acme-card\": AcmeCardElement;")
  })

  it("omits event plumbing for components without typed events", () => {
    const declaration = renderNaosElementDeclaration({
      className: "AcmePlainElement",
      exportName: "AcmePlain",
      tagName: "acme-plain",
      props: [],
      events: [],
    })

    expect(declaration).toContain(
      "export declare class AcmePlainElement extends HTMLElement {\n}"
    )
    expect(declaration).not.toContain("addEventListener")
    expect(declaration).not.toContain("EventMap")
  })

  it("falls back to unknown for untyped event details", () => {
    const declaration = renderNaosElementDeclaration({
      className: "AcmePingElement",
      tagName: "acme-ping",
      events: [{ eventName: "ping" }],
    })

    expect(declaration).toContain("\"ping\": CustomEvent<unknown>;")
    expect(declaration).not.toContain("export {  as")
  })
})
