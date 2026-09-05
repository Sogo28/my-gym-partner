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
        'bg-surface dark:bg-surface-dark border-[1.5px] border-border-strong dark:border-border-strong-dark',
      ghost: 'bg-transparent active:opacity-60',
      danger:
        'bg-[#FDF1F0] dark:bg-[#2A1A16] border-[1.5px] border-[#EAB9B5] dark:border-[#5C332B]',
    },
    size: {
      xl: 'min-h-[68px] rounded-xl',
      // L'action unique de l'état B : plus haute, elle occupe le bas de l'écran.
      '2xl': 'min-h-[84px] rounded-xl',
      lg: 'min-h-[60px] rounded-xl',
      md: 'min-h-[52px] rounded-lg',
    },
    disabled: { true: 'bg-[#E4E7DC] dark:bg-[#232620] border-transparent', false: '' },
  },
  defaultVariants: { variant: 'primary', size: 'lg', disabled: false },
});

const label = cva('text-center', {
  variants: {
    variant: {
      primary: 'text-ink font-black uppercase',
      secondary: 'text-ink dark:text-ink-dark font-bold',
      ghost: 'text-muted dark:text-muted-dark font-medium',
      danger: 'text-danger dark:text-danger-dark font-bold',
    },
    size: {
      xl: 'text-[22px]',
      '2xl': 'text-[24px]',
      lg: 'text-[19px]',
      md: 'text-body',
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
