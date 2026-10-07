import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import type { BodyMetric } from '../src/domain/body/body-metric';
import type { Exercise } from '../src/domain/exercise/exercise';
import type { Measurement } from '../src/domain/exercise/measurement';
import type { Goal, GoalSubject } from '../src/domain/goal/goal';
import { findAll as findAllExercises, findAllMeasurements } from '../src/infra/exercise-repository';
import { Button } from '../src/ui/button';
import { Card } from '../src/ui/card';
import { ConditionProgress, GoalProgression } from '../src/ui/goal-progression';
import { useNotifications } from '../src/ui/notifications';
import { messageOf } from '../src/ui/message';
import { DetailContent, DetailLayout } from '../src/ui/detail-layout';
import { BusinessNotice } from '../src/ui/notice';
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
      <DetailLayout title="Objectif" onBack={() => router.back()}>
        <DetailContent>
          <Text className="text-muted dark:text-muted-dark">Objectif introuvable.</Text>
        </DetailContent>
      </DetailLayout>
    );
  }

  const steps = goal.steps;

  /**
   * Ce que l'étape en cours propose : franchir, ou constater.
   *
   * Composé ici et non dans le rail : décider appartient à l'écran, le rail
   * ne fait que montrer où l'on en est.
   */
  const currentAction = () => {
    if (!evaluation?.satisfied) return null;

    if (goal.isOnLastStep) {
      return <BusinessNotice message="Objectif atteint" detail="C'était la dernière étape." />;
    }

    // Le constat et ce qu'on peut en faire, dans une seule bulle : l'étape
    // suivante se lit déjà juste dessous, sur le rail.
    return (
      <BusinessNotice message="Étape atteinte">
        <Button
          label="Passer à l'étape suivante"
          size="md"
          onPress={() =>
            advanceProgression(goal)
              .then(reload)
              .catch((e) => notify(messageOf(e)))
          }
        />
      </BusinessNotice>
    );
  };

  return (
    <DetailLayout
      title={goal.name}
      // Une progression se voit sur le rail juste dessous : la redire en
      // sous-titre n'apprenait rien.
      subtitle={goal.isProgressive ? undefined : 'Objectif simple'}
      onBack={() => router.back()}
      onMenu={() => setSheet('menu')}
    >
      <DetailContent>
        {/* Une progression se lit comme un chemin : le rail porte l'étape
            en cours ET celles qui l'entourent, au lieu de les séparer. */}
        {goal.isProgressive ? (
          <GoalProgression
            steps={steps}
            currentIndex={goal.currentStepIndex}
            evaluation={evaluation}
            subjectName={subjectName}
            unitOf={unitOf}
            onOpen={(subject) =>
              subject.kind === 'exercise' &&
              router.push({ pathname: '/exercise', params: { id: subject.exerciseId } })
            }
            action={currentAction()}
          />
        ) : (
          <Card density="titled" className="gap-3">
            <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
              Ce qui est visé
            </Text>
            <Text className="font-extrabold text-heading text-ink dark:text-ink-dark">
              {subjectName(goal.currentSubject)}
            </Text>

            {evaluation === null ? (
              <Text className="text-small text-muted dark:text-muted-dark">
                Cet objectif n'a pas de condition : à valider toi-même.
              </Text>
            ) : (
              evaluation.results.map((result, index) => (
                <ConditionProgress key={index} result={result} unitOf={unitOf} />
              ))
            )}
            {currentAction()}
          </Card>
        )}

        {/* Les exercices qui soutiennent une mensuration sans jamais la
            décider : seul le mètre ruban compte. */}
        {goal.currentSubject.kind === 'body' && (
          <SupportingExercises
            muscleIds={metricOf(goal.currentSubject.metricId)?.muscleIds ?? []}
            exercises={exercises}
          />
        )}
      </DetailContent>

      <Sheet
        visible={sheet === 'menu'}
        title={goal.name}
        actions={[
          {
            label: 'Archiver cet objectif',
            icon: 'archive-outline',
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
            icon: 'archive-outline',
            tone: 'danger',
            onPress: () =>
              archiveGoal(goal)
                .then(() => router.back())
                .catch((e) => notify(messageOf(e))),
          },
        ]}
        onClose={() => setSheet('none')}
      />
    </DetailLayout>
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
