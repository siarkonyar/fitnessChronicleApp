/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter"],
      },
      fontSize: {
        xs: "12px",
        sm: "14px",
        base: ["16px", { lineHeight: "24px" }],
        lg: "18px",
        xl: "20px",
        "2xl": ["24px", { lineHeight: "32px" }],
        "3xl": "30px",
        "4xl": "36px",
      },
    },
  },
  plugins: [],
};
