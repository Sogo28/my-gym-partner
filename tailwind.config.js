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
        // Une seule couleur, le vert (`success`) : celui des choses faites,
        // et l'aplat des boutons principaux. Tout le reste -- liens, accents
        // en texte, choix sélectionnés -- est en noir et blanc.
        primary: {
          DEFAULT: '#1B7A45', // aplat d'action : TOUJOURS avec on-primary
          dark: '#4FD68A',
          pressed: '#16663A',
          'pressed-dark': '#3FBF77',
          ink: '#14160F', // l'accent en texte et bordure : la couleur du texte
          'ink-dark': '#F2F4EF',
          soft: '#E4E7DC', // fond d'une pastille, d'une ligne ouverte
          'soft-dark': '#262923',
        },
        // Le texte posé SUR l'aplat d'action : blanc sur le vert foncé du
        // thème clair, foncé sur le vert vif du sombre.
        'on-primary': { DEFAULT: '#FFFFFF', dark: '#14160F' },
        // Un choix sélectionné (une période, un jour) : un aplat noir ou
        // blanc. En vert, il se lirait comme une chose faite.
        selected: { DEFAULT: '#14160F', dark: '#F2F4EF' },
        'on-selected': { DEFAULT: '#F2F4EF', dark: '#14160F' },
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
        // Le même vert, à plat : le fond de ce qui est fait sans être une action
        // -- la carte des records, la pastille d'une séance terminée.
        'success-soft': { DEFAULT: '#E3F4EA', dark: '#16261C' },
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
        // Les deux plus petits ne bougent plus : sous dix pixels, un texte
        // cesse d'être lu et devient une texture.
        micro: ['10px', { lineHeight: '13px' }],
        caption: ['11px', { lineHeight: '14px' }],
        // Les intitulés en capitales : plus petits que le texte, mais espacés
        // pour rester lisibles.
        label: ['11px', { lineHeight: '14px', letterSpacing: '1.1px' }],
        small: ['12px', { lineHeight: '15px' }],
        body: ['13px', { lineHeight: '17px' }],
        lead: ['14px', { lineHeight: '18px' }],
        strong: ['15px', { lineHeight: '20px' }],
        heading: ['17px', { lineHeight: '22px' }],
        value: ['19px', { lineHeight: '23px' }],
        title: ['20px', { lineHeight: '24px' }],
        display: ['36px', { lineHeight: '36px' }],
        // Le chrono se lit de loin, posé au sol entre deux séries : il n'a
        // pas de rang dans la hiérarchie, il occupe l'écran.
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
