import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BodyMetric } from '../src/domain/body/body-metric';
import type { Exercise } from '../src/domain/exercise/exercise';
import type { Measurement } from '../src/domain/exercise/measurement';
import type { Goal, GoalSubject } from '../src/domain/goal/goal';
import { findAll as findAllExercises, findAllMeasurements } from '../src/infra/exercise-repository';
import { Button } from '../src/ui/button';
import { Card } from '../src/ui/card';
import { describeCondition, WINDOW_PHRASES } from '../src/ui/goal-labels';
import { useNotifications } from '../src/ui/notifications';
import { messageOf } from '../src/ui/message';
import { BusinessNotice } from '../src/ui/notice';
import { BackHeader } from '../src/ui/screen-header';
import { Sheet } from '../src/ui/sheet';
import { Tag } from '../src/ui/tag';
import { listMetrics } from '../src/use-cases/body-actions';
import {
  advanceProgression,
  archiveGoal,
  evaluateGoal,
  listGoals,
  type GoalEvaluation,
} from '../src/use-cases/goal-actions';

/**
 * La fiche d'un objectif : où il en est, et ce qu'il reste à faire.
 *
 * Tout ce détail vivait dans la LISTE, qui déroulait pour chaque objectif ses
 * conditions, ses valeurs et ses actions -- illisible dès le troisième. La
 * liste montre désormais des vignettes, et ce qui demande de la place est
 * ici.
 */
export default function GoalScreen() {
  const { notify } = useNotifications();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [evaluation, setEvaluation] = useState<GoalEvaluation | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [sheet, setSheet] = useState<'none' | 'menu' | 'confirm-archive'>('none');

  const reload = useCallback(async () => {
    const [goals, allExercises, allMeasurements, allMetrics] = await Promise.all([
      listGoals(),
      findAllExercises(),
      findAllMeasurements(),
      listMetrics(),
    ]);

    const found = goals.find((candidate) => candidate.id === id) ?? null;
    setGoal(found);
    setExercises(allExercises);
    setMeasurements(allMeasurements);
    setMetrics(allMetrics);
    setEvaluation(found ? await evaluateGoal(found) : null);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      reload().catch((e) => notify(messageOf(e)));
    }, [reload]),
  );

  const metricOf = (metricId: string) => metrics.find((metric) => metric.id === metricId);

  const subjectName = (subject: GoalSubject) =>
    subject.kind === 'exercise'
      ? (exercises.find((exercise) => exercise.id === subject.exerciseId)?.name ??
        subject.exerciseId)
      : (metricOf(subject.metricId)?.name ?? subject.metricId);

  /** L'unité d'une mesure de performance, ou celle d'une mensuration. */
  const unitOf = (measurementId: string | null) =>
    measurementId === null
      ? ''
      : (measurements.find((m) => m.id === measurementId)?.unit ??
        metricOf(measurementId)?.unit ??
        measurementId);

  if (!goal) {
    return (
      <SafeAreaView
        edges={['top', 'bottom']}
        className="flex-1 bg-background p-5 pb-8 dark:bg-background-dark"
      >
        <BackHeader title="Objectif" onBack={() => router.back()} />
        <Text className="text-muted dark:text-muted-dark">Objectif introuvable.</Text>
      </SafeAreaView>
    );
  }

  const steps = goal.steps;

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      className="flex-1 bg-background pb-3 dark:bg-background-dark"
    >
      <View className="px-5 pt-4">
        <BackHeader
          title={goal.name}
          subtitle={
            goal.isProgressive
              ? `progression · étape ${goal.currentStepIndex + 1} sur ${steps.length}`
              : 'objectif simple'
          }
          onBack={() => router.back()}
          onMenu={() => setSheet('menu')}
        />
      </View>

      <ScrollView contentContainerClassName="gap-4 px-5 pb-8" keyboardShouldPersistTaps="handled">

        {/* Ce qui est visé maintenant, et ce que ça demande. */}
        <Card density="titled" className="gap-2">
          <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
            {goal.isProgressive ? 'Étape en cours' : 'Ce qui est visé'}
          </Text>
          <Text className="font-extrabold text-heading text-ink dark:text-ink-dark">
            {subjectName(goal.currentSubject)}
          </Text>

          {/* Chaque condition : ce qu'elle demande, sur quelle période, et ce
              que cette période a réellement donné. */}
          {evaluation?.results.map((result, index) => (
            <View key={index} className="gap-0.5 pt-1">
              <View className="flex-row items-center justify-between gap-3">
                <Text className="shrink text-[13px] text-muted dark:text-muted-dark">
                  {describeCondition(result.condition, unitOf)}
                </Text>
                <Text
                  className={
                    result.satisfied
                      ? 'font-mono-bold text-[15px] text-success dark:text-success-dark'
                      : 'font-mono-bold text-[15px] text-muted dark:text-muted-dark'
                  }
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {result.actual === null ? '—' : Math.round(result.actual * 10) / 10}
                </Text>
              </View>
              <Text className="font-mono text-[11px] text-planned dark:text-planned-dark">
                {WINDOW_PHRASES[result.condition.window]}
                {result.hasData ? '' : ' · aucune donnée'}
              </Text>
            </View>
          ))}

          {/* La suggestion (§24) : proposée, jamais appliquée d'office. */}
          {evaluation === null && (
            <Text className="text-[13px] text-muted dark:text-muted-dark">
              Cette étape n a pas de condition : à valider toi-même.
            </Text>
          )}

          {evaluation?.satisfied && !goal.isOnLastStep && (
            <View className="mt-1 gap-2">
              <BusinessNotice
                message="Étape atteinte"
                detail={`Tu peux passer à ${subjectName(steps[goal.currentStepIndex + 1].subject)}.`}
              />
              <Button
                label="Passer à l étape suivante"
                size="md"
                onPress={() =>
                  advanceProgression(goal)
                    .then(reload)
                    .catch((e) => notify(messageOf(e)))
                }
              />
            </View>
          )}

          {evaluation?.satisfied && goal.isOnLastStep && (
            <BusinessNotice message="Objectif atteint" detail="C était la dernière étape." />
          )}
        </Card>

        {/* Les exercices qui soutiennent une mensuration sans jamais la
            décider : seul le mètre ruban compte. */}
        {goal.currentSubject.kind === 'body' && (
          <SupportingExercises
            muscleIds={metricOf(goal.currentSubject.metricId)?.muscleIds ?? []}
            exercises={exercises}
          />
        )}

        {/* L'échelle entière : d'où l'on vient, où l'on va. */}
        {goal.isProgressive && (
          <View className="gap-2">
            <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
              Progression
            </Text>
            {steps.map((step, index) => (
              <Card
                key={index}
                className={
                  index === goal.currentStepIndex
                    ? 'flex-row items-center justify-between gap-3 border-primary-ink dark:border-primary-ink-dark'
                    : 'flex-row items-center justify-between gap-3'
                }
              >
                <Text
                  className={
                    index < goal.currentStepIndex
                      ? 'shrink text-[15px] text-muted line-through dark:text-muted-dark'
                      : 'shrink text-[15px] text-ink dark:text-ink-dark'
                  }
                  numberOfLines={1}
                >
                  {index + 1}. {subjectName(step.subject)}
                </Text>
                {index < goal.currentStepIndex && <Tag label="franchie" />}
                {index === goal.currentStepIndex && <Tag label="en cours" variant="accent" />}
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      <Sheet
        visible={sheet === 'menu'}
        title={goal.name}
        actions={[
          {
            label: 'Archiver cet objectif',
            tone: 'danger' as const,
            onPress: () => setSheet('confirm-archive'),
          },
        ]}
        onClose={() => setSheet('none')}
      />

      <Sheet
        visible={sheet === 'confirm-archive'}
        title="Archiver cet objectif ?"
        description="Il quitte tes objectifs en cours. Tes performances, elles, ne changent pas."
        actions={[
          {
            label: 'Archiver',
            tone: 'danger',
            onPress: () =>
              archiveGoal(goal)
                .then(() => router.back())
                .catch((e) => notify(messageOf(e))),
          },
        ]}
        onClose={() => setSheet('none')}
      />
    </SafeAreaView>
  );
}

/**
 * Les exercices qui travaillent les muscles concernés par la mensuration.
 *
 * Ils éclairent la progression -- « voilà ce que tu fais pour ça » -- sans
 * entrer dans l'évaluation : seul le mètre ruban décide.
 */
function SupportingExercises({
  muscleIds,
  exercises,
}: {
  muscleIds: readonly string[];
  exercises: readonly Exercise[];
}) {
  const supporting = exercises.filter(
    (exercise) =>
      !exercise.isArchived && exercise.muscleIds.some((id) => muscleIds.includes(id)),
  );

  if (supporting.length === 0) return null;

  return (
    <View className="gap-2">
      <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
        Ce qui la soutient
      </Text>
      <View className="flex-row flex-wrap gap-1.5">
        {supporting.map((exercise) => (
          <Tag key={exercise.id} label={exercise.name} variant="accent-outline" />
        ))}
      </View>
    </View>
  );
}
