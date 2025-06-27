/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,html}"],
  plugins: ["@tailwindcss/container-queries"],
  theme: {
    extend: {
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
