import { View, type ViewProps } from 'react-native';
import { cn } from './cn';

type CardProps = ViewProps & {
  className?: string;
  /** titled : carte de contenu · list : ligne de liste · accent : filet à gauche */
  density?: 'titled' | 'list' | 'accent';
};

export function Card({ className, density = 'list', ...props }: CardProps) {
  return (
    <View
      className={cn(
        'border border-border bg-surface dark:border-border-dark dark:bg-surface-dark',
        density === 'titled' && 'gap-1 rounded-2xl p-4',
        density === 'list' && 'gap-1 rounded-lg p-3.5',
        density === 'accent' && 'gap-1 rounded-2xl border-l-[3px] border-l-primary-ink p-4 dark:border-l-primary-ink-dark',
        className,
      )}
      {...props}
    />
  );
}
