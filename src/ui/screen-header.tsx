import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

type SectionHeaderProps = { title: string; subtitle?: string };

/** Un raccourci vers une page voisine, posé à droite du titre. */
export type HeaderAction = { label: string; onPress: () => void };

/** Variante 1 : titre de section (Historique, Exercices...). */
export function SectionHeader({
  title,
  subtitle,
  action,
}: SectionHeaderProps & { action?: HeaderAction }) {
  return (
    <View className="flex-row items-start justify-between gap-3 pb-2">
      <View className="shrink gap-1">
        <Text className="font-extrabold text-title tracking-tight text-ink dark:text-ink-dark">
          {title}
        </Text>
        {subtitle && (
          <Text className="font-mono text-[12px] text-muted dark:text-muted-dark">{subtitle}</Text>
        )}
      </View>
      {action && (
        <Pressable onPress={action.onPress} hitSlop={8} className="shrink-0 pt-1">
          <Text className="font-bold text-[14px] text-primary-ink dark:text-primary-ink-dark">
            {action.label}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/** Variante 2 : retour + titre. */
export function BackHeader({
  title,
  subtitle,
  onBack,
}: SectionHeaderProps & { onBack: () => void }) {
  return (
    <View className="flex-row items-center gap-3 pb-2">
      <Pressable
        onPress={onBack}
        className="h-12 w-12 items-center justify-center rounded-lg bg-surface-alt dark:bg-surface-alt-dark"
      >
        <Ionicons name="chevron-back" size={22} color="#8B9086" />
      </Pressable>
      <View className="shrink gap-0.5">
        <Text className="font-extrabold text-heading text-ink dark:text-ink-dark" numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text className="font-mono text-[12px] text-muted dark:text-muted-dark">{subtitle}</Text>
        )}
      </View>
    </View>
  );
}

/** Variante 3 : en-tête de séance, avec le menu. */
export function SessionHeader({
  workoutName,
  position,
  onMenu,
}: {
  workoutName: string;
  position: string;
  onMenu: () => void;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3 pb-2">
      <View className="shrink gap-0.5">
        <Text
          className="font-bold uppercase text-[13px] tracking-widest text-primary-ink dark:text-primary-ink-dark"
          numberOfLines={1}
        >
          {workoutName}
        </Text>
        <Text className="font-mono text-[12px] text-muted dark:text-muted-dark">{position}</Text>
      </View>
      <Pressable
        onPress={onMenu}
        hitSlop={8}
        className="h-12 w-12 items-center justify-center rounded-lg bg-surface-alt dark:bg-surface-alt-dark"
      >
        <Ionicons name="ellipsis-horizontal" size={20} color="#8B9086" />
      </Pressable>
    </View>
  );
}
