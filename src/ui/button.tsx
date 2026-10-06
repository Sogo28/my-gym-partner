import { Ionicons } from '@expo/vector-icons';
import { cva, type VariantProps } from 'class-variance-authority';
import { Pressable, Text, useColorScheme, type PressableProps } from 'react-native';
import { cn } from './cn';

/**
 * Le bouton du handoff : quatre variantes, trois tailles.
 *
 * L'aplat citron ne passe qu'avec du texte foncé -- c'est une contrainte de
 * contraste, pas un choix esthétique. En texte et en bordure, l'accent utilise
 * sa version encrée (primary-ink).
 */
const button = cva('flex-row items-center justify-center px-4', {
  variants: {
    variant: {
      primary: 'bg-primary active:bg-primary-pressed',
      secondary:
        'bg-surface dark:bg-surface-dark border-2 border-border-strong dark:border-border-strong-dark',
      ghost: 'bg-transparent active:opacity-60',
      danger:
        'bg-[#FDF1F0] dark:bg-[#2A1A16] border-2 border-[#EAB9B5] dark:border-[#5C332B]',
    },
    // Des hauteurs resserrées : un bouton doit rester atteignable au pouce
    // (44 px au minimum), pas occuper le sixième de l'écran.
    size: {
      xl: 'min-h-[56px] rounded-xl',
      // L'action unique de l'état B : plus haute, elle occupe le bas de l'écran.
      '2xl': 'min-h-[64px] rounded-xl',
      lg: 'min-h-[50px] rounded-lg',
      md: 'min-h-[44px] rounded-lg',
      sm: 'min-h-[38px] rounded-lg',
    },
    disabled: { true: 'bg-[#E4E7DC] dark:bg-[#232620] border-transparent', false: '' },
  },
  defaultVariants: { variant: 'primary', size: 'lg', disabled: false },
});

/**
 * Le libellé : UNE taille et UNE graisse pour tous les boutons, celles d'un
 * titre de carte (`body`, extra-gras).
 *
 * La taille d'un bouton règle sa hauteur -- la cible du pouce --, pas son
 * texte. Un libellé qui grossissait avec le bouton faisait de « Démarrer une
 * séance » le plus gros texte de l'accueil, au-dessus des titres qu'il
 * suit. Seule la couleur change d'une variante à l'autre.
 */
const label = cva('text-center text-body font-extrabold', {
  variants: {
    variant: {
      primary: 'text-ink',
      secondary: 'text-ink dark:text-ink-dark',
      ghost: 'text-muted dark:text-muted-dark',
      danger: 'text-danger dark:text-danger-dark',
    },
    disabled: { true: 'text-planned', false: '' },
  },
  defaultVariants: { variant: 'primary', disabled: false },
});

/**
 * La couleur d'une icône, par variante et par thème.
 *
 * Elle ne peut pas venir de la feuille de styles : une icône reçoit sa
 * couleur en propriété. Elle suit celle du libellé qu'elle remplace.
 */
const ICON_COLORS: Record<'light' | 'dark', Record<string, string>> = {
  light: { primary: '#14160F', secondary: '#14160F', ghost: '#5F6459', danger: '#B3261E' },
  dark: { primary: '#14160F', secondary: '#F2F4EF', ghost: '#8B9086', danger: '#FF7A66' },
};

/** L'icône suit le corps du texte qu'elle remplace, à une taille près. */
const ICON_SIZES: Record<string, number> = { '2xl': 28, xl: 26, lg: 22, md: 20, sm: 18 };

type ButtonProps = Omit<PressableProps, 'disabled'> &
  VariantProps<typeof button> & {
    label: string;
    /**
     * Fournie : elle REMPLACE le libellé, qui reste dire à voix haute ce que
     * le bouton fait -- un pictogramme n'a pas de nom pour qui ne le voit pas.
     */
    icon?: keyof typeof Ionicons.glyphMap;
    className?: string;
    disabled?: boolean;
  };

export function Button({
  label: text,
  icon,
  variant,
  size,
  disabled = false,
  className,
  ...props
}: ButtonProps) {
  const dark = useColorScheme() === 'dark';

  return (
    <Pressable
      disabled={disabled}
      accessibilityLabel={icon ? text : undefined}
      className={cn(button({ variant, size, disabled }), className)}
      {...props}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={ICON_SIZES[size ?? 'lg'] ?? 22}
          color={disabled ? '#A8AD9E' : ICON_COLORS[dark ? 'dark' : 'light'][variant ?? 'primary']}
        />
      ) : (
        <Text className={label({ variant, disabled })}>{text}</Text>
      )}
    </Pressable>
  );
}
