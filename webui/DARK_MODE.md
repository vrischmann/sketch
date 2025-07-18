# Dark Mode Implementation Plan

## Overview

This document outlines the plan to implement dark mode for Sketch's web UI using Tailwind CSS's built-in dark mode capabilities.

## Current State Analysis

Sketch's web UI currently uses:

- Tailwind CSS with basic configuration
- Lit web components extending `SketchTailwindElement`
- Components avoid Shadow DOM (`createRenderRoot() { return this; }`)
- Standard Tailwind classes like `bg-white`, `text-gray-600`, `border-gray-200`
- Global CSS approach, making dark mode implementation straightforward

## Implementation Strategy: Class-Based Dark Mode

### Phase 1: Foundation

#### 1. Update Tailwind Configuration

```javascript
// tailwind.config.js
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,html}"],
  darkMode: "class", // Enable class-based dark mode
  plugins: ["@tailwindcss/container-queries"],
  theme: {
    extend: {
      // Custom colors for better dark mode support
      colors: {
        // Define semantic color tokens
        surface: {
          DEFAULT: "#ffffff",
          dark: "#1f2937",
        },
        "surface-secondary": {
          DEFAULT: "#f9fafb",
          dark: "#374151",
        },
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-in-out",
      },
      keyframes: {
        fadeIn: {
          "0%": {
            opacity: "0",
            transform: "translateX(-50%) translateY(10px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateX(-50%) translateY(0)",
          },
        },
      },
    },
  },
};
```

#### 2. Create Theme Management Service

```typescript
// src/web-components/theme-service.ts
export class ThemeService {
  private static instance: ThemeService;

  static getInstance(): ThemeService {
    if (!this.instance) {
      this.instance = new ThemeService();
    }
    return this.instance;
  }

  toggleTheme(): void {
    const isDark = document.documentElement.classList.contains("dark");
    this.setTheme(isDark ? "light" : "dark");
  }

  setTheme(theme: "light" | "dark"): void {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);

    // Dispatch event for components that need to react
    document.dispatchEvent(
      new CustomEvent("theme-changed", {
        detail: { theme },
      }),
    );
  }

  getTheme(): "light" | "dark" {
    return document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
  }

  initializeTheme(): void {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const theme = saved || (prefersDark ? "dark" : "light");
    this.setTheme(theme as "light" | "dark");

    // Listen for system theme changes
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (e) => {
        if (!localStorage.getItem("theme")) {
          this.setTheme(e.matches ? "dark" : "light");
        }
      });
  }
}
```

#### 3. Theme Toggle Component

```typescript
// src/web-components/theme-toggle.ts
import { html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { SketchTailwindElement } from "./sketch-tailwind-element.js";
import { ThemeService } from "./theme-service.js";

@customElement("theme-toggle")
export class ThemeToggle extends SketchTailwindElement {
  @state() private isDark = false;

  private themeService = ThemeService.getInstance();

  connectedCallback() {
    super.connectedCallback();
    this.isDark = document.documentElement.classList.contains("dark");

    // Listen for theme changes from other sources
    document.addEventListener("theme-changed", this.handleThemeChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("theme-changed", this.handleThemeChange);
  }

  private handleThemeChange = (e: CustomEvent) => {
    this.isDark = e.detail.theme === "dark";
  };

  private toggleTheme() {
    this.themeService.toggleTheme();
  }

  render() {
    return html`
      <button
        @click=${this.toggleTheme}
        class="p-2 rounded-md border border-gray-300 dark:border-gray-600 
               bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200
               hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
               focus:outline-none focus:ring-2 focus:ring-blue-500"
        title="Toggle theme"
        aria-label="Toggle between light and dark mode"
      >
        ${this.isDark ? "☀️" : "🌙"}
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "theme-toggle": ThemeToggle;
  }
}
```

#### 4. Initialize Theme in App Shell

Add theme initialization to the main app shell component:

```typescript
// In sketch-app-shell.ts or similar
import { ThemeService } from "./theme-service.js";

connectedCallback() {
  super.connectedCallback();
  ThemeService.getInstance().initializeTheme();
}
```

### Phase 2: Component Updates

#### Systematic Component Audit

1. **Identify all components using color classes**

   - Search for `bg-`, `text-`, `border-`, `ring-`, `divide-` classes
   - Document current color usage patterns

2. **Add dark mode variants systematically**

   - Start with core components (app shell, chat input, etc.)
   - Update classes following the pattern:

     ```typescript
     // Before:
     class="bg-white text-gray-900 border-gray-200"

     // After:
     class="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-700"
     ```

3. **Priority order for component updates:**
   1. `sketch-app-shell` - Main container
   2. `sketch-chat-input` - Primary interaction component
   3. `sketch-container-status` - Status indicators
   4. `sketch-call-status` - Call indicators
   5. Demo components and other secondary components

#### Common Dark Mode Color Mappings

```scss
// Light -> Dark mappings
bg-white -> bg-gray-900
bg-gray-50 -> bg-gray-800
bg-gray-100 -> bg-gray-800
bg-gray-200 -> bg-gray-700

text-gray-900 -> text-gray-100
text-gray-800 -> text-gray-200
text-gray-700 -> text-gray-300
text-gray-600 -> text-gray-400
text-gray-500 -> text-gray-500 (neutral)

border-gray-200 -> border-gray-700
border-gray-300 -> border-gray-600

ring-gray-300 -> ring-gray-600
```

### Phase 3: Polish and Testing

#### 1. Smooth Transitions

- Add `transition-colors` to interactive elements
- Consider adding a global transition class for theme changes

#### 2. Accessibility

- Ensure sufficient contrast ratios in both modes
- Test with screen readers
- Verify focus indicators work in both themes
- Add proper ARIA labels to theme toggle

#### 3. Testing Checklist

- [ ] Theme persists across page reloads
- [ ] System preference detection works
- [ ] All components render correctly in both modes
- [ ] Interactive states (hover, focus, active) work in both themes
- [ ] No flash of unstyled content (FOUC)
- [ ] Works across different screen sizes
- [ ] Performance impact is minimal

## File Structure

```
src/web-components/
├── theme-service.ts          # Theme management service
├── theme-toggle.ts           # Theme toggle component
├── sketch-tailwind-element.ts # Base class (existing)
└── [other components].ts     # Updated with dark mode variants
```

## Benefits of This Approach

- **Incremental**: Can be implemented component by component
- **Standard**: Uses Tailwind's built-in dark mode features
- **Performant**: Class-based approach is efficient
- **Maintainable**: Clear separation of concerns with theme service
- **Accessible**: Respects system preferences by default
- **Consistent**: Follows Sketch's existing component patterns

## Implementation Timeline

1. **Week 1**: Phase 1 - Foundation (config, service, toggle)
2. **Week 2**: Phase 2 - Core component updates
3. **Week 3**: Phase 2 - Secondary component updates
4. **Week 4**: Phase 3 - Polish, testing, and accessibility

## Notes

- Components extend `SketchTailwindElement` (not `LitElement`)
- No Shadow DOM usage allows for global Tailwind classes
- Theme service uses singleton pattern for consistency
- Event system allows components to react to theme changes
- LocalStorage preserves user preference across sessions
