import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { usePalette } from './palette';
import { ProgressBar, type SessionProgress } from './progress-bar';

type SectionHeaderProps = { title: string; subtitle?: string };

/** Un raccourci vers une page voisine, posé à droite du titre. */
export type HeaderAction = { label: string; onPress: () => void };

/** Variante 1 : titre de section (Historique, Exercices...). */
export function SectionHeader({
  title,
  subtitle,
  action,
  onMenu,
  right,
}: SectionHeaderProps & {
  action?: HeaderAction;
  onMenu?: () => void;
  /** Ce que la page a de particulier à poser à droite du titre, quand ni un
      raccourci textuel ni un menu ne conviennent -- l'avatar, par exemple. */
  right?: ReactNode;
}) {
  const { ink } = usePalette();

  return (
    <View className="flex-row items-start justify-between gap-3 pb-2">
      <View className="shrink gap-1">
        <Text className="font-extrabold text-title tracking-tight text-ink dark:text-ink-dark">
          {title}
        </Text>
        {subtitle && (
          <Text className="font-mono text-small text-muted dark:text-muted-dark">{subtitle}</Text>
        )}
      </View>
      {action && (
        <Pressable onPress={action.onPress} hitSlop={8} className="shrink-0 pt-1">
          <Text className="font-bold text-body text-primary-ink dark:text-primary-ink-dark">
            {action.label}
          </Text>
        </Pressable>
      )}
      {onMenu && (
        <Pressable
          onPress={onMenu}
          hitSlop={8}
          className="h-11 w-11 shrink-0 items-center justify-center active:opacity-50"
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={ink} />
        </Pressable>
      )}
      {right}
    </View>
  );
}

/** Variante 2 : retour + titre, et son menu quand la page en a un. */
export function BackHeader({
  title,
  subtitle,
  onBack,
  onMenu,
}: SectionHeaderProps & { onBack: () => void; onMenu?: () => void }) {
  const { ink } = usePalette();

  return (
    <View className="flex-row items-center gap-3 pb-2">
      <Pressable
        onPress={onBack}
        className="h-12 w-12 items-center justify-center active:opacity-50"
      >
        <Ionicons name="chevron-back" size={24} color={ink} />
      </Pressable>
      <View className="shrink grow gap-0.5">
        <Text className="font-extrabold text-heading text-ink dark:text-ink-dark" numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text className="font-mono text-small text-muted dark:text-muted-dark">{subtitle}</Text>
        )}
      </View>
      {onMenu && (
        <Pressable
          onPress={onMenu}
          hitSlop={8}
          className="h-12 w-12 shrink-0 items-center justify-center active:opacity-50"
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={ink} />
        </Pressable>
      )}
    </View>
  );
}

/** Variante 3 : en-tête de séance, avec le menu. */
export function SessionHeader({
  workoutName,
  position,
  progress,
  onMenu,
}: {
  workoutName: string;
  position: string;
  /** Absente pour une séance libre : sans programme, pas de fin à viser. */
  progress?: SessionProgress;
  onMenu: () => void;
}) {
  const { ink } = usePalette();

  return (
    // Une hauteur FIXE, barre ou pas : c'est celle qu'avait l'en-tête avant
    // elle -- la ligne et sa marge --, et la barre se loge dans la marge.
    // L'anneau d'un EMOM prend la place qui reste ; un en-tête qui grandirait
    // avec un programme le ferait rétrécir d'une séance à l'autre.
    <View className="h-14 justify-between">
      <View className="flex-row items-center justify-between gap-3">
        <View className="shrink gap-0.5">
          <Text
            className="font-bold uppercase text-small tracking-widest text-primary-ink dark:text-primary-ink-dark"
            numberOfLines={1}
          >
            {workoutName}
          </Text>
          <Text className="font-mono text-small text-muted dark:text-muted-dark">{position}</Text>
        </View>
        <Pressable
          onPress={onMenu}
          hitSlop={8}
          className="h-12 w-12 items-center justify-center active:opacity-50"
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={ink} />
        </Pressable>
      </View>
      {progress && progress.segments > 1 && <ProgressBar {...progress} />}
    </View>
  );
}
