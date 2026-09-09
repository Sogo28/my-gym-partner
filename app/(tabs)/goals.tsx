import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Exercise } from '../../src/domain/exercise/exercise';
import type { Measurement } from '../../src/domain/exercise/measurement';
import type { BodyMetric } from '../../src/domain/body/body-metric';
import type { Goal, GoalSubject } from '../../src/domain/goal/goal';
import { findAll as findAllExercises, findAllMeasurements } from '../../src/infra/exercise-repository';
import { listMetrics } from '../../src/use-cases/body-actions';
import { useNotifications } from '../../src/ui/notifications';
import { messageOf } from '../../src/ui/message';
import { GoalCard } from '../../src/ui/goal-card';
import { EmptyState } from '../../src/ui/empty-state';
import { SearchField } from '../../src/ui/search';
import { fold } from '../../src/text';
import { Fab } from '../../src/ui/fab';
import { SectionHeader } from '../../src/ui/screen-header';
import {
  evaluateGoal,
  listGoals,
  type GoalEvaluation,
} from '../../src/use-cases/goal-actions';

export default function GoalsScreen() {
  const { notify } = useNotifications();
  const router = useRouter();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [evaluations, setEvaluations] = useState<Map<string, GoalEvaluation | null>>(new Map());
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [query, setQuery] = useState('');

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
      reload().catch((e) => notify(messageOf(e)));
    }, [reload]),
  );

  const nameOf = (id: string) => exercises.find((e) => e.id === id)?.name ?? id;
  const metricOf = (id: string) => metrics.find((m) => m.id === id);

  /**
   * L'unité d'une condition : celle d'une mesure de performance, ou celle
   * d'une mensuration -- une condition sur un tour de cuisse s'exprime en cm.
   */
  const unitOf = (id: string | null) =>
    id === null ? '' : (measurements.find((m) => m.id === id)?.unit ?? metricOf(id)?.unit ?? id);

  /** Ce que l'objectif vise, exercice ou mensuration. */
  const subjectName = (subject: GoalSubject) =>
    subject.kind === 'exercise'
      ? nameOf(subject.exerciseId)
      : (metricOf(subject.metricId)?.name ?? subject.metricId);

  const active = goals.filter((goal) => goal.status === 'ACTIVE');
  // La recherche porte sur le nom de l'objectif ET sur ce qu'il vise : on se
  // souvient plus souvent de l'exercice que du titre qu'on lui a donné.
  const shown = active.filter((goal) => {
    const needle = fold(query.trim());
    if (needle === '') return true;
    return (
      fold(goal.name).includes(needle) ||
      goal.steps.some((step) => fold(subjectName(step.subject)).includes(needle))
    );
  });

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-5 pt-4">
        <SectionHeader
          title="Objectifs"
          subtitle={`${active.length} en cours · évalués sur tes performances`}
          // Les mensurations sont une page voisine, pas une action de
          // celle-ci : en bas, elles se seraient fait passer pour telle.
          action={{ label: 'Mensurations', onPress: () => router.push('/body') }}
        />

        <View className="pb-3">
          <SearchField value={query} onChange={setQuery} placeholder="Chercher un objectif" />
        </View>
      </View>

      <ScrollView
        contentContainerClassName="grow gap-3 px-5 pb-28"
        keyboardShouldPersistTaps="handled"
      >
        {active.length === 0 && (
          <EmptyState
            title="Aucun objectif"
            description="Un objectif suit une progression : chaque étape est un exercice, avec ce qu'il faut atteindre pour passer à la suivante."
          />
        )}

        {active.length > 0 && shown.length === 0 && (
          <EmptyState
            title="Aucun résultat"
            description="Aucun objectif ne correspond à cette recherche."
          />
        )}

        {shown.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            evaluation={evaluations.get(goal.id)}
            subjectName={(entry) => subjectName(entry.currentSubject)}
            unitOf={unitOf}
            onPress={() => router.push({ pathname: '/goal', params: { id: goal.id } })}
          />
        ))}
      </ScrollView>

      <Link href="/new-goal" asChild>
        <Fab accessibilityLabel="Nouvel objectif" />
      </Link>
    </SafeAreaView>
  );
}
