/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./views/**/*.ejs", "./public/**/*.js"],
  // Classes built dynamically in .ejs (e.g. `pill-label-<%= key %>`) never
  // appear as a literal string in the source file, so Tailwind's content
  // scanner can't see them and silently drops the CSS rule — even for custom
  // @layer components classes we author ourselves. List every such
  // dynamically-assembled class here so it's always generated regardless.
  safelist: ["pill-label-present", "pill-label-late", "pill-label-absent"],
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
