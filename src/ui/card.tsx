import { View, type ViewProps } from 'react-native';
import { cn } from './cn';

export function Card({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn('gap-1 rounded-2xl border border-border p-4', className)} {...props} />;
}
