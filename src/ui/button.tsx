import { cva, type VariantProps } from 'class-variance-authority';
import { Pressable, Text, type PressableProps } from 'react-native';
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

const label = cva('text-center', {
  variants: {
    variant: {
      primary: 'text-ink font-black',
      secondary: 'text-ink dark:text-ink-dark font-bold',
      ghost: 'text-muted dark:text-muted-dark font-medium',
      danger: 'text-danger dark:text-danger-dark font-bold',
    },
    size: {
      xl: 'text-[19px]',
      '2xl': 'text-[21px]',
      lg: 'text-[17px]',
      md: 'text-[15px]',
      sm: 'text-[13px]',
    },
    disabled: { true: 'text-planned', false: '' },
  },
  defaultVariants: { variant: 'primary', size: 'lg', disabled: false },
});

type ButtonProps = Omit<PressableProps, 'disabled'> &
  VariantProps<typeof button> & {
    label: string;
    className?: string;
    disabled?: boolean;
  };

export function Button({
  label: text,
  variant,
  size,
  disabled = false,
  className,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      className={cn(button({ variant, size, disabled }), className)}
      {...props}
    >
      <Text className={label({ variant, size, disabled })}>{text}</Text>
    </Pressable>
  );
}
