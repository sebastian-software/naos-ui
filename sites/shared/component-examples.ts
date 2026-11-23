// The catalogue and playground share the same examples and public tag names.
export const componentExamples = [
  {
    id: "preferences",
    label: "Notification preferences",
    description: "Change the form controls, then reset them to their initial values.",
    markup: `<form>
        <naos-field label="Notifications">
          <naos-switch name="updates" label="Email updates" checked />
          <naos-checkbox name="digest" label="Weekly digest" />
          <naos-toggle name="mute" label="Mute notifications" />
        </naos-field>
        <button type="reset">Reset preferences</button>
      </form>`,
  },
  {
    id: "search",
    label: "Search and suggestions",
    description:
      "Choose a destination or type your own. The region selector accepts listed options.",
    markup: `<naos-combobox free-text name="city" label="Destination">
        <naos-combobox-item value="berlin" label="Berlin" />
        <naos-combobox-item value="oslo" label="Oslo" />
      </naos-combobox>
      <naos-select label="Region" value="europe">
        <naos-select-item value="europe" label="Europe" />
        <naos-select-item value="asia" label="Asia" />
      </naos-select>`,
  },
  {
    id: "choices",
    label: "Single and multiple choice",
    description:
      "Compare a radio group, a segmented control, a listbox and a multiple-selection toggle group.",
    markup: `<naos-radio-group label="Visibility" value="team">
        <naos-radio value="team" label="Team" />
        <naos-radio value="public" label="Public" />
      </naos-radio-group>
      <naos-segmented-control label="Schedule" value="week">
        <naos-segmented-item value="day" label="Daily" />
        <naos-segmented-item value="week" label="Weekly" />
      </naos-segmented-control>
      <naos-listbox label="Audience" value="design">
        <naos-listbox-item value="design" label="Design" />
        <naos-listbox-item value="engineering" label="Engineering" />
      </naos-listbox>
      <naos-toggle-group label="Channels" multiple>
        <naos-toggle-item value="email" label="Email" />
        <naos-toggle-item value="chat" label="Chat" />
      </naos-toggle-group>`,
  },
  {
    id: "numbers",
    label: "Numeric input and ratings",
    description: "Step through quantities, move the slider with arrow keys or rate an item.",
    markup: `<naos-number-input label="Copies" value="2" min="1" max="10" />
      <naos-slider label="Volume" value="40" min="0" max="100" step="10" />
      <naos-rating-group label="Sound quality" value="3" />`,
  },
  {
    id: "entry",
    label: "Text, dates and files",
    description: "Edit a title, add tags, pick a date or choose a local file.",
    markup: `<naos-editable label="Title" value="Field notes" />
      <naos-tags-input label="Topics" value="travel,design" placeholder="Add a topic" />
      <naos-date-picker label="Travel date" value="2026-06-18" />
      <naos-pin-input label="Booking code" count="4" />
      <naos-file-upload label="Attach itinerary" accept=".txt,.pdf" />`,
  },
  {
    id: "panels",
    label: "Tabs and disclosures",
    description: "Switch between panels and expand sections with the keyboard.",
    markup: `<naos-tabs value="overview">
        <naos-tab value="overview" label="Overview" />
        <naos-tab value="details" label="Details" />
        <naos-tab-panel value="overview">Your itinerary at a glance.</naos-tab-panel>
        <naos-tab-panel value="details">Departure from platform four.</naos-tab-panel>
      </naos-tabs>
      <naos-accordion label="Trip details" value="arrival">
        <naos-accordion-item value="arrival" label="Arrival">Check in at reception.</naos-accordion-item>
        <naos-accordion-item value="access" label="Access">Use the east entrance.</naos-accordion-item>
      </naos-accordion>
      <naos-collapsible label="Packing list">Bring a notebook.</naos-collapsible>
      <naos-dropdown label="Booking details">Confirmation number N42.</naos-dropdown>`,
  },
  {
    id: "menus",
    label: "Menus and checked items",
    description: "Toggle a checkbox, switch between radio choices or open the context menu.",
    markup: `<naos-menu label="View options">
        <naos-menu-item type="checkbox" value="grid" label="Show grid" checked />
        <naos-menu-item type="radio" name="density" value="roomy" label="Roomy" checked />
        <naos-menu-item type="radio" name="density" value="compact" label="Compact" />
      </naos-menu>
      <naos-context-menu>
        <span slot="trigger">Right-click this file</span>
        <naos-menu-item value="rename" label="Rename" />
        <naos-menu-item value="copy" label="Copy" />
      </naos-context-menu>`,
  },
  {
    id: "overlays",
    label: "Dialogs and popovers",
    description: "Open a confirmation, inspect a popover or focus a trigger to reveal a hint.",
    markup: `<naos-dialog alert label="Review removal" title="Remove this draft?" description="This deletes the saved draft.">
        <span slot="close">Cancel</span>
      </naos-dialog>
      <naos-popover label="Storage details" title="Draft storage">Drafts are kept on this device.</naos-popover>
      <naos-tooltip label="Keyboard shortcut" text="Press Escape to dismiss." />
      <naos-hover-card label="Draft owner" title="Editorial team" text="Reviews and publishes drafts." />`,
  },
  {
    id: "feedback",
    label: "Actions and feedback",
    description: "Advance or reset the upload progress, then trigger a notification.",
    setup: "const progress = state(25)",
    markup: `<naos-avatar alt="Sam Lee" fallback="SL" />
      <naos-progress label="Upload progress" value={progress()} />
      <naos-button-group label="Upload controls">
        <naos-button label="Advance" variant="primary" onClick={() => progress.update((n) => Math.min(n + 25, 100))} />
        <naos-button label="Reset" onClick={() => progress.set(0)} />
      </naos-button-group>
      <naos-toast label="Show notification" title="Upload complete" description="Your file is ready." type="success" />
      <naos-toast-root label="Notifications" />`,
  },
].map((example) => ({
  ...example,
  tags: [...new Set(Array.from(example.markup.matchAll(/<(naos-[\w-]+)/g), ([, tag]) => tag!))],
}))
