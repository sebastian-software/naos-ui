/** Minimal shape accepted from an application-owned Trusted Types policy. */
export type TemplateHtmlPolicy = {
  createHTML(source: string): unknown
}

let templateHtmlPolicy: TemplateHtmlPolicy | undefined

/**
 * Configures the policy used by generated template-backend components.
 *
 * Applications that enforce `require-trusted-types-for 'script'` must supply
 * their own policy before connecting a component compiled with
 * `domBackend: "template"` or a selected `"auto"` component. Naos never
 * creates a policy name on the application's behalf.
 */
export function configureTemplateHtmlPolicy(policy: TemplateHtmlPolicy | undefined): void {
  templateHtmlPolicy = policy
}

/** Creates a detached HTML template using the configured Trusted Types policy. */
export function createTemplate(html: string): HTMLTemplateElement {
  const template = document.createElement("template")
  try {
    template.innerHTML = (templateHtmlPolicy?.createHTML(html) ?? html) as string
  } catch (error) {
    throw new Error(
      "Naos could not initialize a template. If this application enforces Trusted Types, call configureTemplateHtmlPolicy() with an application-owned policy before connecting template-backend components.",
      { cause: error },
    )
  }
  return template
}
