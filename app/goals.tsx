import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Exercise } from '../src/domain/exercise/exercise';
import type { Measurement } from '../src/domain/exercise/measurement';
import type { BodyMetric } from '../src/domain/body/body-metric';
import type { Goal, GoalSubject } from '../src/domain/goal/goal';
import { findAll as findAllExercises, findAllMeasurements } from '../src/infra/exercise-repository';
import { listMetrics } from '../src/use-cases/body-actions';
import { Button } from '../src/ui/button';
import { describeCondition, WINDOW_PHRASES } from '../src/ui/goal-labels';
import { messageOf } from '../src/ui/message';
import { Card } from '../src/ui/card';
import { EmptyState } from '../src/ui/empty-state';
import { BusinessNotice } from '../src/ui/notice';
import { SectionHeader } from '../src/ui/screen-header';
import {
  advanceProgression,
  archiveGoal,
  evaluateGoal,
  listGoals,
  type GoalEvaluation,
} from '../src/use-cases/goal-actions';

export default function GoalsScreen() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [evaluations, setEvaluations] = useState<Map<string, GoalEvaluation | null>>(new Map());
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [all, allExercises, allMeasurements, allMetrics] = await Promise.all([
      listGoals(),
      findAllExercises(),
      findAllMeasurements(),
      listMetrics(),
    ]);
    setGoals(all);
    setExercises(allExercises);
    setMeasurements(allMeasurements);
    setMetrics(allMetrics);

    // L'évaluation est recalculée à chaque affichage : elle dérive des
    // performances et n'est jamais stockée (§23).
    const results = await Promise.all(all.map((goal) => evaluateGoal(goal)));
    setEvaluations(new Map(all.map((goal, index) => [goal.id, results[index]])));
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload().catch((e) => setError(messageOf(e)));
    }, [reload]),
  );

  const nameOf = (id: string) => exercises.find((e) => e.id === id)?.name ?? id;
  const metricOf = (id: string) => metrics.find((m) => m.id === id);

  /**
   * L'unité d'une condition : celle d'une mesure de performance, ou celle
   * d'une mensuration -- une condition sur un tour de cuisse s'exprime en cm.
   */
  const unitOf = (id: string) =>
    measurements.find((m) => m.id === id)?.unit ?? metricOf(id)?.unit ?? id;

  /** Ce que l'objectif vise, exercice ou mensuration. */
  const subjectName = (subject: GoalSubject) =>
    subject.kind === 'exercise'
      ? nameOf(subject.exerciseId)
      : (metricOf(subject.metricId)?.name ?? subject.metricId);

  const active = goals.filter((goal) => goal.status === 'ACTIVE');

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-5 pt-4">
        <SectionHeader
          title="Objectifs"
          subtitle={`${active.length} en cours · évalués sur tes performances`}
        />
      </View>

      <ScrollView contentContainerClassName="gap-3 px-5 pb-4">
        {error && <BusinessNotice message={error} />}
        {active.length === 0 && (
          <EmptyState
            title="Aucun objectif"
            description="Un objectif suit une progression : chaque étape est un exercice, avec ce qu'il faut atteindre pour passer à la suivante."
          />
        )}

        {active.map((goal) => {
          const evaluation = evaluations.get(goal.id);

          return (
            <Card key={goal.id} density="titled" className="gap-2">
              <View className="flex-row items-start justify-between gap-3">
                <Text className="shrink font-extrabold text-heading text-ink dark:text-ink-dark">
                  {goal.name}
                </Text>
                <View className="items-end gap-1">
                  <Text className="font-mono text-[12px] text-muted dark:text-muted-dark">
                    {goal.isProgressive
                      ? `étape ${goal.currentStepIndex + 1}/${goal.steps.length}`
                      : 'objectif simple'}
                  </Text>
                  <Pressable
                    onPress={() =>
                      archiveGoal(goal)
                        .then(reload)
                        .catch((e) => setError(messageOf(e)))
                    }
                    hitSlop={8}
                  >
                    <Text className="text-[12px] text-muted dark:text-muted-dark">archiver</Text>
                  </Pressable>
                </View>
              </View>

              <Text className="font-bold text-[16px] text-ink dark:text-ink-dark">
                {subjectName(goal.currentSubject)}
              </Text>

              {/* Ce qui soutient la progression sans jamais la décider : les
                  exercices qui travaillent les mêmes muscles. */}
              {goal.currentSubject.kind === 'body' && (
                <SupportingExercises
                  muscleIds={metricOf(goal.currentSubject.metricId)?.muscleIds ?? []}
                  exercises={exercises}
                />
              )}

              {/* Chaque condition, avec ce qu'elle demande, sur quelle
                  période, et ce que cette période a réellement donné. */}
              {evaluation?.results.map((result, index) => (
                <View key={index} className="gap-0.5">
                  <View className="flex-row items-center justify-between gap-3">
                    <Text className="shrink text-[13px] text-muted dark:text-muted-dark">
                      {describeCondition(result.condition, unitOf)}
                    </Text>
                    <Text
                      className={
                        result.satisfied
                          ? 'font-mono-bold text-[14px] text-success dark:text-success-dark'
                          : 'font-mono-bold text-[14px] text-muted dark:text-muted-dark'
                      }
                      style={{ fontVariant: ['tabular-nums'] }}
                    >
                      {result.actual === null ? '—' : Math.round(result.actual * 10) / 10}
                    </Text>
                  </View>
                  <Text className="font-mono text-[11px] text-planned">
                    {WINDOW_PHRASES[result.condition.window]}
                    {result.hasData ? '' : ' · aucune donnée'}
                  </Text>
                </View>
              ))}

              {/* La suggestion (§24) : proposée, jamais appliquée d'office. */}
              {evaluation === null && (
                <Text className="text-[13px] text-muted dark:text-muted-dark">
                  Cette étape n'a pas de condition : à valider toi-même.
                </Text>
              )}

              {evaluation?.satisfied && !goal.isOnLastStep && (
                <View className="mt-1 gap-2">
                  <BusinessNotice
                    message="Étape atteinte"
                    detail={`Tu peux passer à ${subjectName(goal.steps[goal.currentStepIndex + 1].subject)}.`}
                  />
                  <Button
                    label="Passer à l'étape suivante"
                    size="md"
                    onPress={() =>
                      advanceProgression(goal)
                        .then(reload)
                        .catch((e) => setError(messageOf(e)))
                    }
                  />
                </View>
              )}

              {evaluation?.satisfied && goal.isOnLastStep && (
                <BusinessNotice message="Objectif atteint" detail="C'était la dernière étape." />
              )}
            </Card>
          );
        })}
      </ScrollView>

      <View className="gap-2 px-5 pb-2">
        <Link href="/new-goal" asChild>
          <Button label="Nouvel objectif" size="lg" />
        </Link>
        <Link href="/body" asChild>
          <Button label="Mes mensurations" variant="secondary" size="md" />
        </Link>
      </View>
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
  exercises: Exercise[];
}) {
  const supporting = exercises.filter(
    (exercise) =>
      !exercise.isArchived && exercise.muscleIds.some((id) => muscleIds.includes(id)),
  );

  if (supporting.length === 0) return null;

  return (
    <View className="mt-1 gap-1">
      <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
        Ce qui soutient
      </Text>
      <Text className="text-[13px] text-muted dark:text-muted-dark">
        {supporting.map((exercise) => exercise.name).join(' · ')}
      </Text>
    </View>
  );
}
