import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, Text, useColorScheme, View } from 'react-native';
import type { ExerciseMedia } from '../domain/exercise/media';
import type { Goal, GoalSubject } from '../domain/goal/goal';
import type { GoalEvaluation } from '../use-cases/goal-actions';
import { Card } from './card';
import { conditionProgress, visibleSteps } from './checklist';
import { cn } from './cn';
import { targetUnit } from './goal-labels';
import { useMediaImage } from './media-image';
import { PALETTE, usePalette } from './palette';
import { ProgressBar } from './progress-bar';

/**
 * Où en est une étape. `reached` : celle en cours, dont la condition tient
 * déjà -- elle n'est pas franchie pour autant, l'avancée se décide à la main.
 */
type StepState = 'done' | 'current' | 'reached' | 'upcoming';

/**
 * Un objectif en liste d'étapes : son nom, une barre, puis les étapes autour
 * de celle en cours.
 *
 * Une progression EST une liste à cocher -- Tuck, Advanced Tuck, One Leg --
 * et c'est ainsi qu'elle se lit le mieux. Un objectif simple, lui, n'a pas
 * d'étapes : sa carte n'a pas de liste (voir plus bas).
 *
 * Les étapes franchies ne sont pas barrées : dans l'app, le barré veut dire
 * « série abandonnée ». La coche verte et le texte atténué suffisent.
 */
export function GoalChecklist({
  goal,
  evaluation,
  nameOf,
  mediaOf,
  unitOf,
  width,
  onPress,
}: {
  goal: Goal;
  evaluation: GoalEvaluation | null | undefined;
  /** Le nom de ce qu'une étape vise : l'appelant seul a les catalogues. */
  nameOf: (subject: GoalSubject) => string;
  /** L'illustration d'un exercice visé, s'il en a une. */
  mediaOf: (subject: GoalSubject) => ExerciseMedia | undefined;
  unitOf: (measurementId: string | null) => string;
  width?: number;
  onPress?: () => void;
}) {
  const first = evaluation?.results[0];
  const fraction = evaluation?.satisfied ? 1 : conditionProgress(first);
  const current = goal.currentStepIndex;

  /** Où en est la valeur : « 5 / 10 s ». */
  const value = first ? (
    <Text
      className="font-mono-bold text-small text-ink dark:text-ink-dark"
      style={{ fontVariant: ['tabular-nums'] }}
    >
      {first.actual === null ? '—' : `${Math.round(first.actual * 10) / 10}`}
      <Text className="font-mono text-micro text-muted dark:text-muted-dark">
        {' / '}
        {first.condition.target} {targetUnit(first.condition, unitOf)}
      </Text>
    </Text>
  ) : null;

  /*
   * Un objectif simple n'a pas d'étapes : une liste d'une seule ligne en
   * aurait l'air, sans en avoir le sens. Ce qu'il vise passe à côté de son
   * nom, et la barre porte la valeur au lieu d'un pourcentage -- c'est elle
   * qu'on vient lire.
   */
  if (!goal.isProgressive) {
    const subject = goal.currentSubject;

    return (
      <Pressable onPress={onPress} style={width ? { width } : undefined}>
        <Card density="titled" className="gap-3">
          <View className="flex-row items-center gap-3">
            <SubjectAvatar subject={subject} media={mediaOf(subject)} />
            <View className="shrink grow">
              <Text
                className="font-extrabold text-body text-ink dark:text-ink-dark"
                numberOfLines={1}
              >
                {goal.name}
              </Text>
              <Text className="text-micro text-muted dark:text-muted-dark" numberOfLines={1}>
                {nameOf(subject)}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-3">
            <View className="flex-1">
              <ProgressBar segments={1} current={0} fraction={fraction} />
            </View>
            {value}
            {evaluation?.satisfied && <StepMark state="reached" />}
          </View>
        </Card>
      </Pressable>
    );
  }

  const rows = visibleSteps(goal.steps.length, current).map((index) => ({
    subject: goal.steps[index].subject,
    index,
    state: (index < current
      ? 'done'
      : index > current
        ? 'upcoming'
        : evaluation?.satisfied
          ? 'reached'
          : 'current') as StepState,
  }));

  return (
    <Pressable onPress={onPress} style={width ? { width } : undefined}>
      <Card density="titled" className="gap-3">
        <View className="gap-2">
          <Text className="font-extrabold text-body text-ink dark:text-ink-dark" numberOfLines={1}>
            {goal.name}
          </Text>
          <View className="flex-row items-center gap-3">
            <View className="flex-1">
              <ProgressBar segments={goal.steps.length} current={current} fraction={fraction} />
            </View>
            <Text
              className="font-mono text-micro text-muted dark:text-muted-dark"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {current}/{goal.steps.length}
            </Text>
          </View>
        </View>

        <View className="gap-2">
          {rows.map(({ subject, state, index }) => (
            <View key={index} className="h-11 flex-row items-center gap-3">
              <SubjectAvatar subject={subject} media={mediaOf(subject)} />

              <View className="shrink grow">
                <Text
                  className={cn(
                    'font-bold text-body',
                    state === 'done' || state === 'upcoming'
                      ? 'text-muted dark:text-muted-dark'
                      : 'text-ink dark:text-ink-dark',
                  )}
                  numberOfLines={1}
                >
                  {nameOf(subject)}
                </Text>
              </View>

              {state === 'current' && value ? (
                value
              ) : (
                <StepMark state={state} />
              )}
            </View>
          ))}
        </View>
      </Card>
    </Pressable>
  );
}

/**
 * Le rond de droite : plein et coché une fois franchie, coché en pointillés
 * quand la condition tient mais que l'étape attend d'être validée, vide
 * sinon.
 */
function StepMark({ state }: { state: StepState }) {
  const { primaryInk } = usePalette();
  const dark = useColorScheme() === 'dark';

  if (state === 'done') {
    return (
      // Le vert des choses faites, comme une série validée.
      <View className="h-7 w-7 items-center justify-center rounded-full bg-success dark:bg-success-dark">
        <Ionicons name="checkmark" size={16} color={dark ? PALETTE.light.ink : '#FFFFFF'} />
      </View>
    );
  }

  // Plus petite que la coche pleine : elle annonce, elle n'affirme pas.
  if (state === 'reached') {
    return (
      <View className="h-7 w-7 items-center justify-center">
        <View className="h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-dashed border-primary-ink dark:border-primary-ink-dark">
          <Ionicons name="checkmark" size={11} color={primaryInk} />
        </View>
      </View>
    );
  }

  return (
    <View className="h-7 w-7 items-center justify-center rounded-full border-2 border-border-strong dark:border-border-strong-dark" />
  );
}

/**
 * Ce qu'une étape vise, en rond : l'illustration de l'exercice quand il en a
 * une, sinon une icône qui dit la nature de la chose -- une barre pour un
 * exercice, un écartement pour une mensuration.
 */
function SubjectAvatar({ subject, media }: { subject: GoalSubject; media?: ExerciseMedia }) {
  const { muted } = usePalette();
  const uri = useMediaImage(media);

  return (
    <View className="h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-alt dark:bg-surface-alt-dark">
      {uri ? (
        <Image source={{ uri }} style={{ width: 36, height: 36 }} resizeMode="cover" />
      ) : (
        <Ionicons
          name={subject.kind === 'exercise' ? 'barbell-outline' : 'resize-outline'}
          size={18}
          color={muted}
        />
      )}
    </View>
  );
}
