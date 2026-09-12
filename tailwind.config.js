/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: { "error-container": "#ffdad6", "on-secondary-container": "#00714e", "primary": "#00355f", "on-primary-fixed": "#001c37", "primary-fixed": "#d2e4ff", "primary-fixed-dim": "#a0c9ff", "inverse-on-surface": "#eef0ff", "on-tertiary-fixed": "#001d31", "on-primary": "#ffffff", "secondary-container": "#82f5c1", "secondary-fixed-dim": "#68dba9", "on-tertiary-container": "#74c1ff", "on-surface": "#131b2e", "on-background": "#131b2e", "on-error-container": "#93000a", "surface": "#faf8ff", "secondary-fixed": "#85f8c4", "outline-variant": "#c2c7d1", "tertiary-fixed": "#cce5ff", "on-tertiary": "#ffffff", "tertiary": "#003756", "background": "#faf8ff", "on-secondary": "#ffffff", "inverse-surface": "#283044", "surface-tint": "#2d6197", "tertiary-fixed-dim": "#93ccff", "surface-dim": "#d2d9f4", "on-secondary-fixed": "#002114", "tertiary-container": "#004e78", "surface-container-lowest": "#ffffff", "on-tertiary-fixed-variant": "#004b73", "surface-bright": "#faf8ff", "surface-container-low": "#f2f3ff", "on-secondary-fixed-variant": "#005137", "surface-container": "#eaedff", "error": "#ba1a1a", "outline": "#727780", "on-primary-fixed-variant": "#07497d", "on-primary-container": "#8ebdf9", "inverse-primary": "#a0c9ff", "surface-container-high": "#e2e7ff", "surface-variant": "#dae2fd", "on-error": "#ffffff", "on-surface-variant": "#42474f", "surface-container-highest": "#dae2fd", "secondary": "#006c4a", "primary-container": "#0f4c81" },
      borderRadius: { "DEFAULT": "0.125rem", "lg": "0.25rem", "xl": "0.5rem", "full": "0.75rem" },
      spacing: { "space-md": "0.75rem", "margin-lg": "2rem", "space-xs": "0.25rem", "gutter-lg": "1.5rem", "space-xl": "1.5rem", "margin": "1rem", "gutter": "1rem", "space-lg": "1rem", "space-sm": "0.5rem" },
      fontFamily: { "body-sm": ["Inter", "sans-serif"], "body-lg": ["Inter", "sans-serif"], "headline-sm": ["Plus Jakarta Sans", "sans-serif"], "display-lg": ["Plus Jakarta Sans", "sans-serif"], "code-mono": ["JetBrains Mono", "monospace"], "label-sm": ["Inter", "sans-serif"], "label-md": ["Inter", "sans-serif"], "headline-lg": ["Plus Jakarta Sans", "sans-serif"], "body-md": ["Inter", "sans-serif"] },
      fontSize: {
        "body-sm": ["12px", { "lineHeight": "16px", "fontWeight": "400" }],
        "body-lg": ["16px", { "lineHeight": "24px", "fontWeight": "400" }],
        "headline-sm": ["18px", { "lineHeight": "26px", "fontWeight": "600" }],
        "display-lg": ["32px", { "lineHeight": "40px", "letterSpacing": "-0.02em", "fontWeight": "700" }],
        "code-mono": ["12px", { "lineHeight": "16px", "fontWeight": "500" }],
        "label-sm": ["11px", { "lineHeight": "14px", "letterSpacing": "0.03em", "fontWeight": "600" }],
        "label-md": ["13px", { "lineHeight": "18px", "letterSpacing": "0.01em", "fontWeight": "600" }],
        "headline-lg": ["24px", { "lineHeight": "32px", "letterSpacing": "-0.01em", "fontWeight": "600" }],
        "body-md": ["14px", { "lineHeight": "20px", "fontWeight": "400" }]
      }
    }
  },
  plugins: [],
}
