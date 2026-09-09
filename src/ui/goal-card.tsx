import { Pressable, Text, View } from 'react-native';
import type { Goal } from '../domain/goal/goal';
import { Card } from './card';
import { describeSourceShort, targetUnit } from './goal-labels';
import type { GoalEvaluation } from '../use-cases/goal-actions';

/**
 * Un objectif en vignette : son nom, ce qu'il vise, où il en est.
 *
 * Le même dessin sur l'accueil et dans la liste : un objectif doit se
 * reconnaître d'un écran à l'autre, et deux versions du même résumé
 * auraient divergé au premier ajustement.
 *
 * Quatre lignes toujours, occupées ou non : c'est ce qui aligne les vignettes
 * entre elles sans qu'aucune ne s'étire.
 */
export function GoalCard({
  goal,
  evaluation,
  subjectName,
  unitOf,
  width,
  onPress,
}: {
  goal: Goal;
  evaluation: GoalEvaluation | null | undefined;
  /** Le nom de ce qui est visé : l'appelant seul a les catalogues. */
  subjectName: (goal: Goal) => string;
  unitOf: (measurementId: string | null) => string;
  /** Fixe en rangée horizontale, pleine largeur en liste. */
  width?: number;
  onPress?: () => void;
}) {
  const results = evaluation?.results ?? [];
  // La première condition suffit à situer l'objectif ; le compte dit qu'il y
  // en a d'autres, sans les empiler sur une vignette.
  const first = results[0];
  const met = results.filter((result) => result.satisfied).length;

  return (
    <Pressable onPress={onPress} style={width ? { width } : undefined}>
      <Card className="gap-2">
        <Text
          className="h-[38px] font-bold text-lead leading-[19px] text-ink dark:text-ink-dark"
          numberOfLines={2}
        >
          {goal.name}
        </Text>

        <Text
          className="text-small text-primary-ink dark:text-primary-ink-dark"
          numberOfLines={1}
        >
          {subjectName(goal)}
        </Text>

        {first ? (
          <View className="gap-0.5">
            <Text
              className="font-mono-bold text-value text-ink dark:text-ink-dark"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {first.actual === null ? '—' : `${Math.round(first.actual * 10) / 10}`}
              <Text className="font-sans text-small text-muted dark:text-muted-dark">
                {' / '}
                {first.condition.target} {targetUnit(first.condition, unitOf)}
              </Text>
            </Text>
            <Text className="text-micro text-muted dark:text-muted-dark" numberOfLines={1}>
              {results.length > 1
                ? `${met} condition${met > 1 ? 's' : ''} sur ${results.length}`
                : describeSourceShort(first.condition)}
            </Text>
          </View>
        ) : (
          <Text className="text-caption text-muted dark:text-muted-dark">
            {goal.isProgressive
              ? `étape ${goal.currentStepIndex + 1}/${goal.steps.length}`
              : 'à valider à la main'}
          </Text>
        )}
      </Card>
    </Pressable>
  );
}
