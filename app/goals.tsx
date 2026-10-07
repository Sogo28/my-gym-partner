import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text } from 'react-native';
import type { Exercise } from '../src/domain/exercise/exercise';
import type { Measurement } from '../src/domain/exercise/measurement';
import type { BodyMetric } from '../src/domain/body/body-metric';
import type { Goal, GoalSubject } from '../src/domain/goal/goal';
import { findAll as findAllExercises, findAllMeasurements } from '../src/infra/exercise-repository';
import { listMetrics } from '../src/use-cases/body-actions';
import { useNotifications } from '../src/ui/notifications';
import { messageOf } from '../src/ui/message';
import { GoalChecklist } from '../src/ui/goal-checklist';
import { EmptyState } from '../src/ui/empty-state';
import { SearchField } from '../src/ui/search';
import { fold } from '../src/text';
import { Fab } from '../src/ui/fab';
import {
  evaluateGoal,
  listGoals,
  type GoalEvaluation,
} from '../src/use-cases/goal-actions';
import { ListContent, ListLayout } from '../src/ui/list-layout';

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

  /** L'illustration d'un exercice visé : la première image, jamais une vidéo. */
  const imageOf = (subject: GoalSubject) =>
    subject.kind === 'exercise'
      ? exercises
          .find((exercise) => exercise.id === subject.exerciseId)
          ?.media.find((media) => media.kind === 'image')
      : undefined;

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
    // Les mensurations ne sont plus annoncées ici : le profil les range à
    // côté des objectifs, et deux chemins vers la même page en font une
    // qu'on ne sait plus où chercher.
    <ListLayout
      title="Objectifs"
      subtitle={`${active.length} en cours`}
      onBack={() => router.back()}
      toolbar={<SearchField value={query} onChange={setQuery} placeholder="Chercher un objectif" />}
    >
      <ListContent>
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
          <GoalChecklist
            key={goal.id}
            goal={goal}
            evaluation={evaluations.get(goal.id)}
            nameOf={subjectName}
            mediaOf={imageOf}
            unitOf={unitOf}
            onPress={() => router.push({ pathname: '/goal', params: { id: goal.id } })}
          />
        ))}
      </ListContent>

      <Link href="/new-goal" asChild>
        <Fab accessibilityLabel="Nouvel objectif" />
      </Link>
    </ListLayout>
  );
}
