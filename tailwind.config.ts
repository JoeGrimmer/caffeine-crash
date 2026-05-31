import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        cream: "#fff7ea",
        foam: "#fffaf1",
        latte: "#f4dcc0",
        caramel: "#b8651f",
        roast: "#4a2414",
        espresso: "#2a170f",
        sage: "#8fa56c",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(74, 36, 20, 0.12)",
        button: "0 12px 24px rgba(184, 101, 31, 0.26)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
