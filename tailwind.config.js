/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/ui/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],

  // Pas de darkMode: 'class' : le handoff précise que l'app suit le réglage
  // système, ce que NativeWind fait par défaut avec la variante `dark:`.
  theme: {
    extend: {
      // Couleurs nommées par leur RÔLE. Le suffixe -dark est la valeur du
      // mode sombre, à utiliser via `dark:` (ex. bg-surface dark:bg-surface-dark).
      colors: {
        primary: {
          DEFAULT: '#BFF04A', // aplat d'action : TOUJOURS avec du texte foncé
          ink: '#46600F', // le même accent en texte et bordure (mode clair)
          'ink-dark': '#BFF04A',
          soft: '#E7F3C8',
          'soft-dark': '#232A16',
          pressed: '#A6D63F',
        },
        background: { DEFAULT: '#F6F7F3', dark: '#0E0F0D' },
        surface: { DEFAULT: '#FFFFFF', dark: '#191B17' },
        'surface-alt': { DEFAULT: '#EDEFE8', dark: '#141613' },
        border: {
          DEFAULT: '#DDE0D6',
          dark: '#2A2D28',
          strong: '#C3C8B8',
          'strong-dark': '#3A3F37',
        },
        ink: { DEFAULT: '#14160F', dark: '#F2F4EF' }, // texte principal
        muted: { DEFAULT: '#5F6459', dark: '#8B9086' },
        planned: { DEFAULT: '#A8AD9E', dark: '#8B9086' },
        success: { DEFAULT: '#1B7A45', dark: '#4FD68A' },
        danger: { DEFAULT: '#B3261E', dark: '#FF7A66' },
      },

      fontFamily: {
        // Une famille par graisse : React Native ne synthétise pas le gras,
        // il faut charger et nommer chaque fichier de police.
        sans: ['Archivo_400Regular'],
        medium: ['Archivo_500Medium'],
        bold: ['Archivo_700Bold'],
        extrabold: ['Archivo_800ExtraBold'],
        black: ['Archivo_900Black'],
        mono: ['JetBrainsMono_400Regular'],
        'mono-bold': ['JetBrainsMono_800ExtraBold'],
      },

      fontSize: {
        label: ['12px', { lineHeight: '16px', letterSpacing: '1.2px' }],
        body: ['16px', { lineHeight: '24px' }],
        heading: ['20px', { lineHeight: '26px' }],
        title: ['26px', { lineHeight: '30px' }],
        value: ['22px', { lineHeight: '26px' }],
        display: ['44px', { lineHeight: '43px' }],
        timer: ['52px', { lineHeight: '52px' }],
      },

      // L'échelle d'espacement de Tailwind est déjà en base 4 : on ne la
      // remplace pas, on ajoute seulement les hauteurs de cibles tactiles.
      minHeight: { touch: '48px', action: '60px', 'action-xl': '68px' },
      borderRadius: { sm: '6px', md: '12px', lg: '14px', xl: '18px' },
    },
  },
  plugins: [],
};
