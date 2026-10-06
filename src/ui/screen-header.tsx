import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { usePalette } from './palette';

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
  const { muted } = usePalette();

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
          className="h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-alt dark:bg-surface-alt-dark"
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={muted} />
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
  const { muted } = usePalette();

  return (
    <View className="flex-row items-center gap-3 pb-2">
      <Pressable
        onPress={onBack}
        className="h-12 w-12 items-center justify-center rounded-lg bg-surface-alt dark:bg-surface-alt-dark"
      >
        <Ionicons name="chevron-back" size={22} color={muted} />
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
          className="h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-alt dark:bg-surface-alt-dark"
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={muted} />
        </Pressable>
      )}
    </View>
  );
}

/**
 * Où l'on en est dans le programme : un segment par exercice prévu.
 *
 * Les exercices passés sont pleins, celui en cours se remplit série après
 * série, les suivants attendent. La ligne de texte dit la même chose en
 * chiffres ; la barre la dit d'un coup d'oeil, de loin.
 */
export type SessionProgress = {
  /** Le nombre d'exercices du programme. */
  readonly segments: number;
  /** La place de l'exercice en cours, à partir de zéro. */
  readonly current: number;
  /** La part déjà faite de l'exercice en cours, entre 0 et 1. */
  readonly fraction: number;
};

function ProgressBar({ segments, current, fraction }: SessionProgress) {
  return (
    <View className="flex-row gap-1" accessibilityLabel={`Exercice ${current + 1} sur ${segments}`}>
      {Array.from({ length: segments }, (_, index) => {
        const filled = index < current ? 1 : index === current ? Math.min(1, Math.max(0, fraction)) : 0;
        return (
          <View
            key={index}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-border dark:bg-border-dark"
          >
            <View
              className="h-full rounded-full bg-primary-ink dark:bg-primary"
              style={{ width: `${filled * 100}%` }}
            />
          </View>
        );
      })}
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
  const { muted } = usePalette();

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
          className="h-12 w-12 items-center justify-center rounded-lg bg-surface-alt dark:bg-surface-alt-dark"
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={muted} />
        </Pressable>
      </View>
      {progress && progress.segments > 1 && <ProgressBar {...progress} />}
    </View>
  );
}
