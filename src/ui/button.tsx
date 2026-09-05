import { cva, type VariantProps } from 'class-variance-authority';
import { Pressable, Text, type PressableProps } from 'react-native';
import { cn } from './cn';

/**
 * Les variantes sont déclarées une fois ici, plus dans chaque écran.
 * Un bouton "outline" a la même allure partout, par construction.
 */
const button = cva('flex-row items-center justify-center rounded-2xl', {
  variants: {
    variant: {
      default: 'bg-primary active:opacity-80',
      outline: 'border border-primary/30 bg-white active:bg-muted',
      ghost: 'active:bg-muted',
      destructive: 'bg-destructive active:opacity-80',
    },
    size: {
      default: 'px-4 py-4',
      lg: 'px-5 py-5',
      sm: 'px-3 py-2',
    },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

const buttonText = cva('font-semibold', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      outline: 'text-primary',
      ghost: 'text-muted-foreground',
      destructive: 'text-white',
    },
    size: { default: 'text-base', lg: 'text-lg', sm: 'text-sm' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

type ButtonProps = PressableProps &
  VariantProps<typeof button> & {
    label: string;
    className?: string;
  };

export function Button({ label, variant, size, className, ...props }: ButtonProps) {
  return (
    <Pressable className={cn(button({ variant, size }), className)} {...props}>
      <Text className={buttonText({ variant, size })}>{label}</Text>
    </Pressable>
  );
}
