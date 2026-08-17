/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./views/**/*.ejs", "./public/**/*.js"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0f4c81",
          dark: "#0b3a63",
          light: "#e8f0f8",
        },
      },
    },
  },
  plugins: [],
};
