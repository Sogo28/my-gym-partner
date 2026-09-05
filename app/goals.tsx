import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Exercise } from '../src/domain/exercise/exercise';
import type { Measurement } from '../src/domain/exercise/measurement';
import type { Condition, Goal } from '../src/domain/goal/goal';
import { findAll as findAllExercises, findAllMeasurements } from '../src/infra/exercise-repository';
import { Button } from '../src/ui/button';
import { Card } from '../src/ui/card';
import { EmptyState } from '../src/ui/empty-state';
import { BusinessNotice } from '../src/ui/notice';
import { SectionHeader } from '../src/ui/screen-header';
import {
  advanceProgression,
  evaluateGoal,
  listGoals,
  type GoalEvaluation,
} from '../src/use-cases/goal-actions';

export default function GoalsScreen() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [evaluations, setEvaluations] = useState<Map<string, GoalEvaluation>>(new Map());
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [all, allExercises, allMeasurements] = await Promise.all([
      listGoals(),
      findAllExercises(),
      findAllMeasurements(),
    ]);
    setGoals(all);
    setExercises(allExercises);
    setMeasurements(allMeasurements);

    // L'évaluation est recalculée à chaque affichage : elle dérive des
    // performances et n'est jamais stockée (§23).
    const results = await Promise.all(all.map((goal) => evaluateGoal(goal)));
    setEvaluations(new Map(all.map((goal, index) => [goal.id, results[index]])));
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload().catch((e) => setError(String(e)));
    }, [reload]),
  );

  const nameOf = (id: string) => exercises.find((e) => e.id === id)?.name ?? id;
  const unitOf = (id: string) => measurements.find((m) => m.id === id)?.unit ?? id;

  function describe(condition: Condition): string {
    const metric = condition.metric;
    if (metric.type === 'setCount') return `${condition.operator} ${condition.value} séries`;
    const label = { average: 'moyenne', max: 'meilleur', min: 'minimum', total: 'total' }[
      metric.type
    ];
    return `${label} ${condition.operator} ${condition.value} ${unitOf(metric.measurementId)}`;
  }

  const active = goals.filter((goal) => goal.status === 'ACTIVE');

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-5 pt-4">
        <SectionHeader
          title="Objectifs"
          subtitle={`${active.length} en cours · évalués sur ta dernière séance`}
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
          const step = goal.currentStep;

          return (
            <Card key={goal.id} density="titled" className="gap-2">
              <View className="flex-row items-start justify-between gap-3">
                <Text className="shrink font-extrabold text-heading text-ink dark:text-ink-dark">
                  {goal.name}
                </Text>
                <Text className="font-mono text-[12px] text-muted dark:text-muted-dark">
                  étape {goal.currentStepIndex + 1}/{goal.steps.length}
                </Text>
              </View>

              <Text className="font-bold text-[16px] text-ink dark:text-ink-dark">
                {nameOf(step.exerciseId)}
              </Text>

              {/* Chaque condition, avec ce qu'elle demande et ce que la
                  dernière séance a donné. */}
              {evaluation?.results.map((result, index) => (
                <View key={index} className="flex-row items-center justify-between gap-3">
                  <Text className="shrink text-[13px] text-muted dark:text-muted-dark">
                    {describe(result.condition)}
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
              ))}

              {evaluation && !evaluation.hasData && (
                <Text className="text-[13px] text-muted dark:text-muted-dark">
                  Aucune séance enregistrée pour cet exercice.
                </Text>
              )}

              {/* La suggestion (§24) : proposée, jamais appliquée d'office. */}
              {evaluation?.satisfied && !goal.isOnLastStep && (
                <View className="mt-1 gap-2">
                  <BusinessNotice
                    message="Étape atteinte"
                    detail={`Tu peux passer à ${nameOf(goal.steps[goal.currentStepIndex + 1].exerciseId)}.`}
                  />
                  <Button
                    label="Passer à l'étape suivante"
                    size="md"
                    onPress={() =>
                      advanceProgression(goal)
                        .then(reload)
                        .catch((e) => setError(String(e)))
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

      <View className="px-5 pb-2">
        <Link href="/new-goal" asChild>
          <Button label="Nouvel objectif" size="lg" />
        </Link>
      </View>
    </SafeAreaView>
  );
}
