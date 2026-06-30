const preset = require('@pilotage/config/tailwind-preset');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [preset],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
};
