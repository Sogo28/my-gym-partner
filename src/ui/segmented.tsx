import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { cn } from './cn';
import { usePalette } from './palette';

export type Segment<T extends string | number> = {
  readonly value: T;
  readonly label: string;
  readonly icon?: keyof typeof Ionicons.glyphMap;
};

/**
 * Un choix parmi quelques options -- quatre au plus --, côte à côte dans un
 * même rail : « Progressif | Simple », « Immédiat | 3 s | 5 s | 10 s ».
 *
 * L'option retenue se détache sur le rail comme une carte posée dessus ; les
 * autres restent dans le rail, en gris. Un seul geste, et ce qu'on a choisi
 * se lit sans chercher -- là où deux grandes cartes rivalisaient avec le
 * reste du formulaire.
 */
export function Segmented<T extends string | number>({
  segments,
  value,
  onChange,
}: {
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { ink, muted } = usePalette();

  return (
    <View className="flex-row gap-1 rounded-xl bg-surface-alt p-1 dark:bg-surface-alt-dark">
      {segments.map((segment) => {
        const on = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            onPress={() => onChange(segment.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            className={cn(
              'h-10 flex-1 flex-row items-center justify-center gap-1.5 rounded-lg',
              on && 'border border-border bg-surface dark:border-border-dark dark:bg-surface-dark',
            )}
          >
            {segment.icon && <Ionicons name={segment.icon} size={16} color={on ? ink : muted} />}
            <Text
              className={cn(
                'text-body',
                on
                  ? 'font-extrabold text-ink dark:text-ink-dark'
                  : 'font-medium text-muted dark:text-muted-dark',
              )}
            >
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
