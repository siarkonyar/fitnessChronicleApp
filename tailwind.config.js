/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter"],
        bebas: ["BebasNeue"],
        lora: ["Lora-Regular"],
        "lora-medium": ["Lora-Medium"],
        "lora-semibold": ["Lora-SemiBold"],
        "lora-bold": ["Lora-Bold"],
        "lora-italic": ["Lora-Italic"],
        "lora-bold-italic": ["Lora-BoldItalic"],
      },
    },
  },
  plugins: [],
};
