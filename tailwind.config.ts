import type { Config } from "tailwindcss";

// Every color token resolves to a CSS custom property defined in
// client/src/index.css, which mirrors public/design/colors_and_type.css.
// Keep the names in sync.

export default {
  darkMode: ["class"],
  content: ["./client/src/**/*.{ts,tsx}", "./client/index.html"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        fg: "var(--fg)",
        "fg-muted": "var(--fg-muted)",
        "fg-subtle": "var(--fg-subtle)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        "accent-press": "var(--accent-press)",
        "accent-ink": "var(--accent-ink)",
        success: "var(--success)",
        warning: "var(--warning)",
        error: "var(--error)",
      },
      borderRadius: {
        none: "0",
        xs: "2px",
        sm: "4px",
        md: "6px",
      },
      fontFamily: {
        display: ["Inter Tight", "system-ui", "-apple-system", "sans-serif"],
        body: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SF Mono", "Menlo", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        eyebrow: ["11px", { lineHeight: "1", letterSpacing: "0.08em" }],
        caption: ["12px", { lineHeight: "1.4" }],
        small: ["13px", { lineHeight: "1.5" }],
        body: ["14px", { lineHeight: "1.6" }],
      },
      letterSpacing: {
        eyebrow: "0.08em",
        tight: "-0.02em",
      },
      boxShadow: {
        pop: "0 2px 8px rgba(0,0,0,0.08)",
        menu: "0 4px 16px rgba(0,0,0,0.10)",
      },
      transitionTimingFunction: {
        ds: "cubic-bezier(0.2, 0, 0, 1)",
      },
      transitionDuration: {
        fast: "120ms",
        base: "160ms",
        slow: "220ms",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
