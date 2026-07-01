import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ground: "#FFFFFF",
        ink: "#111111",
        accent: "#E85D26",
        "accent-navy": "#1A3A5C",
        muted: "#6B7280",
        border: "#E5E7EB",
        "surface-warm": "#F9F7F5",
      },
      fontFamily: {
        serif: ["Noto Serif", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        "display-xl": ["3.5rem", { lineHeight: "1.05", letterSpacing: "-0.03em" }],
        "display-lg": ["2.5rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "display-md": ["1.875rem", { lineHeight: "1.15", letterSpacing: "-0.015em" }],
        "body-lg": ["1.125rem", { lineHeight: "1.75" }],
        "body-md": ["1rem", { lineHeight: "1.7" }],
        "label": ["0.75rem", { lineHeight: "1", letterSpacing: "0.1em" }],
      },
      maxWidth: {
        prose: "68ch",
        site: "1200px",
      },
      borderRadius: {
        DEFAULT: "2px",
        sm: "2px",
        md: "4px",
        lg: "4px",
      },
    },
  },
  plugins: [],
};

export default config;
