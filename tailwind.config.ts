import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#e6fffb",
          100: "#b5f5ec",
          200: "#87e8de",
          300: "#5cdbd3",
          400: "#36cfc9",
          500: "#0fc6c2",
          600: "#10b4b0",
          700: "#0a9e9a",
          800: "#07817d",
          900: "#056260",
        },
        sidebar: "#001529",
        "sidebar-hover": "#002140",
        "page-bg": "#f0f2f5",
      },
      fontFamily: {
        sans: ['"PingFang SC"', '"Helvetica Neue"', "Arial", "sans-serif"],
      },
      borderRadius: {
        card: "8px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.08)",
        dropdown: "0 6px 16px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
