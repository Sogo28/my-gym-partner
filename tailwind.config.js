/** @type {import('tailwindcss').Config} */
module.exports = {
  // Les fichiers scannés pour trouver les classes utilisées.
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/ui/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // Des couleurs nommées par leur RÔLE, pas par leur teinte : changer
      // l'identité de l'app se fera ici, sans toucher aux écrans.
      colors: {
        primary: { DEFAULT: '#2563eb', foreground: '#ffffff' },
        muted: { DEFAULT: '#f4f4f5', foreground: '#71717a' },
        border: '#e4e4e7',
        destructive: '#dc2626',
        success: '#15803d',
        faded: '#d4d4d8',
      },
    },
  },
  plugins: [],
};
