const defaultTheme = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,vue}",
  ],
  theme: {
    fontFamily: {
      'sans': ['"Barlow Condensed"', ...defaultTheme.fontFamily.sans],
    }
  },
  plugins: [require("daisyui")],
}
