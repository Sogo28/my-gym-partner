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

      /**
       * L'échelle typographique. Aucun écran ne fixe une taille lui-même :
       * il choisit un RÔLE, et le rôle décide.
       *
       * Chaque pas porte son interligne, et c'est là que la compacité se
       * gagne : sans interligne déclaré, React Native applique celui de la
       * police -- environ une fois et demie la taille, ce qui aère un texte
       * de paragraphe et gaspille une ligne sur deux dans une carte.
       *
       * Les tailles, elles, bougent peu : on lit cet écran entre deux séries,
       * parfois de loin, et rogner les glyphes coûterait la lisibilité que la
       * compacité est censée servir.
       */
      fontSize: {
        micro: ['10px', { lineHeight: '13px' }],
        caption: ['11px', { lineHeight: '14px' }],
        // Les intitulés en capitales : plus petits que le texte, mais espacés
        // pour rester lisibles.
        label: ['11px', { lineHeight: '14px', letterSpacing: '1.1px' }],
        small: ['12px', { lineHeight: '16px' }],
        body: ['14px', { lineHeight: '19px' }],
        lead: ['15px', { lineHeight: '20px' }],
        strong: ['16px', { lineHeight: '21px' }],
        heading: ['18px', { lineHeight: '23px' }],
        value: ['20px', { lineHeight: '24px' }],
        title: ['22px', { lineHeight: '26px' }],
        display: ['40px', { lineHeight: '40px' }],
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
