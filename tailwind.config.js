/** @type {import('tailwindcss').Config} */
module.exports = {
  // Les fichiers scannés pour trouver les classes utilisées.
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/ui/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {},
  },
  plugins: [],
};
