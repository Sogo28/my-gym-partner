import { Text, View } from 'react-native';
import { Button } from './button';

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View className="items-center gap-3 rounded-xl border border-dashed border-border-strong px-5 py-8 dark:border-border-strong-dark">
      <Text className="font-extrabold text-[18px] text-ink dark:text-ink-dark">{title}</Text>
      <Text className="max-w-[250px] text-center text-[13px] text-muted dark:text-muted-dark">
        {description}
      </Text>
      {actionLabel && onAction && (
        <Button label={actionLabel} variant="secondary" size="md" onPress={onAction} className="mt-2 px-6" />
      )}
    </View>
  );
}
