# Component Architecture: sketch-tool-card and Related Components

This document explains the relationship between LitElement subclasses in webui/src/web-components/ and the sketch-tool-card custom element, focusing on their containment relationship and CSS styling effects.

## Containment Relationship

The component hierarchy and containment relationship is structured as follows:

1. **sketch-app-shell** (the main application container)
   - Contains **sketch-timeline** (for displaying conversation history)
     - Contains **sketch-timeline-message** (for individual messages)
       - Contains **sketch-tool-calls** (collection of tool calls)
         - Contains specific tool card components like:
           - **sketch-tool-card-bash**
           - **sketch-tool-card-think**
           - **sketch-tool-card-codereview**
           - **sketch-tool-card-done**
           - **sketch-tool-card-patch**
           - **sketch-tool-card-take-screenshot**
           - **sketch-tool-card-set-slug**
           - **sketch-tool-card-commit-message-style**
           - **sketch-tool-card-multiple-choice**
           - **sketch-tool-card-generic** (fallback for unknown tools)
             - All of these specialized components **contain** or **compose with** the base **sketch-tool-card**

The key aspect is that the specialized tool card components do not inherit from `SketchToolCard` in a class hierarchy sense. Instead, they **use composition** by embedding a `<sketch-tool-card>` element within their render method and passing data to it.

For example, from `sketch-tool-card-bash.ts`:

```typescript
render() {
  return html` <sketch-tool-card
    .open=${this.open}
    .toolCall=${this.toolCall}
  >
    <span slot="summary" class="summary-text">...</span>
    <div slot="input" class="input">...</div>
    <div slot="result" class="result">...</div>
  </sketch-tool-card>`;
}
```

## CSS Styling and Effects

Regarding how CSS rules defined in sketch-tool-card affect elements that contain it:

1. **Shadow DOM Encapsulation**:

   - Each Web Component has its own Shadow DOM, which encapsulates its styles
   - Styles defined in `sketch-tool-card` apply only within its shadow DOM, not to parent components

2. **Slot Content Styling**:

   - The base `sketch-tool-card` defines three slots: "summary", "input", and "result"
   - Specialized tool cards provide content for these slots
   - The base component can style the slot containers, but cannot directly style the slotted content

3. **Style Inheritance and Sharing**:

   - The code uses a `commonStyles` constant that is shared across some components
   - These common styles ensure consistent styling for elements like pre, code blocks
   - Each specialized component adds its own unique styles as needed

4. **Parent CSS Targeting**:

   - In `sketch-timeline-message.ts`, there are styles that target the tool components using the `::slotted()` pseudo-element:

   ```css
   ::slotted(sketch-tool-calls) {
     max-width: 100%;
     width: 100%;
     overflow-wrap: break-word;
     word-break: break-word;
   }
   ```

   - This allows parent components to influence the layout of slotted components while preserving Shadow DOM encapsulation

5. **Host Element Styling**:

   - The `:host` selector is used in sketch-tool-card for styling the component itself:

   ```css
   :host {
     display: block;
     max-width: 100%;
     width: 100%;
     box-sizing: border-box;
     overflow: hidden;
   }
   ```

   - This affects how the component is displayed in its parent context

In summary, the architecture uses composition rather than inheritance, with specialized tool cards wrapping the base sketch-tool-card component and filling its slots with custom content. The CSS styling is carefully managed through Shadow DOM, with some targeted styling using ::slotted selectors to ensure proper layout and appearance throughout the component hierarchy.

# API URLs Must Be Relative

When making fetch requests to backend APIs in Sketch, all URLs **must be relative** without leading slashes. The base URL for Sketch varies depending on how it is deployed and run:

```javascript
// CORRECT - use relative paths without leading slash
const response = await fetch(`git/rawdiff?commit=${commit}`);
const data = await fetch(`git/show?hash=${hash}`);

// INCORRECT - do not use absolute paths with leading slash
const response = await fetch(`/git/rawdiff?commit=${commit}`); // WRONG!
const data = await fetch(`/git/show?hash=${hash}`); // WRONG!
```

The reason for this requirement is that Sketch may be deployed:

1. At the root path of a domain
2. In a subdirectory
3. Behind a proxy with a path prefix
4. In different environments (dev, production)

Using relative paths ensures that requests are correctly routed regardless of the deployment configuration. The browser will resolve the URLs relative to the current page location.
