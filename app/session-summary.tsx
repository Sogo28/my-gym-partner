import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Exercise } from '../src/domain/exercise/exercise';
import type { Measurement } from '../src/domain/exercise/measurement';
import type { PlannedWorkout } from '../src/domain/planned-workout/planned-workout';
import { findAll as findAllExercises, findAllMeasurements } from '../src/infra/exercise-repository';
import { findAll as findAllPlans } from '../src/infra/planned-workout-repository';
import { BodyMap } from '../src/ui/body-map';
import { highlight } from '../src/ui/body-slugs';
import { Button } from '../src/ui/button';
import { Card } from '../src/ui/card';
import { formatClock, formatDateTime } from '../src/ui/format';
import { GoalCard } from '../src/ui/goal-card';
import { messageOf } from '../src/ui/message';
import { useNotifications } from '../src/ui/notifications';
import { SectionHeader } from '../src/ui/screen-header';
import { formatSetValues } from '../src/ui/set-values';
import { advanceProgression, goalsReachedBy, type ReachedGoal } from '../src/use-cases/goal-actions';
import { findSessionSummary, type SessionSummary } from '../src/use-cases/session-summary';

/**
 * Ce qu'on vient de faire, une fois la séance close.
 *
 * Un bilan et non un écran de plus à traverser : il se lit, il ne se remplit
 * pas. Il répond à trois questions qu'on se pose en rangeant ses affaires --
 * qu'est-ce que j'ai travaillé, ai-je fait ce qui était prévu, et est-ce que
 * ça fait avancer quelque chose.
 */
export default function SessionSummaryScreen() {
  const { notify } = useNotifications();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [plans, setPlans] = useState<PlannedWorkout[]>([]);
  const [reached, setReached] = useState<ReachedGoal[]>([]);

  const reload = useCallback(async () => {
    const [found, allExercises, allMeasurements, allPlans] = await Promise.all([
      findSessionSummary(id),
      findAllExercises(),
      findAllMeasurements(),
      findAllPlans(),
    ]);
    setSummary(found);
    setExercises(allExercises);
    setMeasurements(allMeasurements);
    setPlans(allPlans);

    // Les objectifs que CETTE séance met à portée : les autres étaient déjà
    // acquis avant d'entrer dans la salle.
    const worked = [...new Set((found?.activities ?? []).map((entry) => entry.exerciseId))];
    setReached(await goalsReachedBy(worked));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      reload().catch((e) => notify(messageOf(e)));
    }, [reload]),
  );

  const exerciseOf = (exerciseId: string) => exercises.find((e) => e.id === exerciseId);
  const nameOf = (exerciseId: string) => exerciseOf(exerciseId)?.name ?? exerciseId;
  const unitOf = (measurementId: string | null) =>
    measurementId === null
      ? ''
      : (measurements.find((m) => m.id === measurementId)?.unit ?? measurementId);

  if (!summary) {
    return (
      <SafeAreaView
        edges={['top', 'bottom']}
        className="flex-1 bg-background p-5 dark:bg-background-dark"
      >
        <Text className="text-muted dark:text-muted-dark">Séance introuvable.</Text>
      </SafeAreaView>
    );
  }

  const plan = plans.find((candidate) => candidate.id === summary.session.plannedWorkoutId);

  // Un exercice ne compte comme travaillé que s'il a produit une série : en
  // ouvrir un puis passer au suivant n'a rien fait travailler.
  const worked = summary.activities
    .filter((activity) => activity.completedSets.length > 0)
    .map((activity) => exerciseOf(activity.exerciseId))
    .filter((exercise) => exercise !== undefined);

  const muscles = highlight(
    worked.map((exercise) => exercise.primaryMuscleId).filter((id) => id !== null),
    worked.flatMap((exercise) => exercise.secondaryMuscleIds),
  );

  const plannedSets = plan?.exercises.reduce((total, entry) => total + entry.sets.length, 0) ?? 0;

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      className="flex-1 bg-background pb-3 dark:bg-background-dark"
    >
      <View className="px-5 pt-4">
        <SectionHeader
          title="Séance terminée"
          subtitle={`${plan ? plan.name : 'Séance libre'} · ${formatDateTime(summary.session.startedAt)}`}
        />
      </View>

      <ScrollView
        contentContainerClassName="gap-4 px-5 pb-8"
        keyboardShouldPersistTaps="handled"
      >
        {/* Les trois chiffres qu'on retient d'une séance. */}
        <View className="flex-row gap-3">
          <Figure value={summary.duration === null ? '—' : formatClock(summary.duration)} label="durée" />
          <Figure value={String(worked.length)} label={worked.length > 1 ? 'exercices' : 'exercice'} />
          <Figure
            value={
              plannedSets > 0
                ? `${summary.completedSetCount}/${plannedSets}`
                : String(summary.completedSetCount)
            }
            label={plannedSets > 0 ? 'séries prévues' : 'séries'}
          />
        </View>

        {/* Ce qu'on a travaillé, sans avoir à relire la liste des exercices. */}
        {worked.length > 0 && (
          <Card density="titled" className="items-center gap-2">
            <Text className="self-start font-bold uppercase text-label text-muted dark:text-muted-dark">
              Travaillé
            </Text>
            <BodyMap parts={muscles} scale={0.62} />
          </Card>
        )}

        {/* Ce qu'une séance vient de mettre à portée : proposé, jamais
            appliqué d'office (n°17). */}
        {reached.length > 0 && (
          <View className="gap-2">
            <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
              {reached.length > 1 ? 'Étapes atteintes' : 'Étape atteinte'}
            </Text>
            {reached.map(({ goal, evaluation }) => (
              <View key={goal.id} className="gap-2">
                <GoalCard
                  goal={goal}
                  evaluation={evaluation}
                  subjectName={(entry) =>
                    entry.currentSubject.kind === 'exercise'
                      ? nameOf(entry.currentSubject.exerciseId)
                      : entry.currentSubject.metricId
                  }
                  unitOf={unitOf}
                  onPress={() => router.push({ pathname: '/goal', params: { id: goal.id } })}
                />
                {!goal.isOnLastStep && (
                  <Button
                    label="Passer à l étape suivante"
                    size="md"
                    onPress={() =>
                      advanceProgression(goal)
                        .then(() => notify('Étape franchie.', 'success'))
                        .then(reload)
                        .catch((e) => notify(messageOf(e)))
                    }
                  />
                )}
              </View>
            ))}
          </View>
        )}

        {/* Le détail, en texte : c'est un bilan qu'on relit, pas une saisie. */}
        <View className="gap-2">
          <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
            Ce que tu as fait
          </Text>

          {summary.activities.map((activity, index) => {
            const prevu = plan?.exercises.find(
              (entry) => entry.exerciseId === activity.exerciseId,
            )?.sets.length;

            return (
              <Card key={index} className="gap-1">
                <Pressable
                  onPress={() =>
                    router.push({ pathname: '/exercise', params: { id: activity.exerciseId } })
                  }
                >
                  <Text
                    className="font-bold text-[15px] text-ink dark:text-ink-dark"
                    numberOfLines={1}
                  >
                    {nameOf(activity.exerciseId)}
                  </Text>
                </Pressable>

                {activity.completedSets.length === 0 ? (
                  <Text className="text-[13px] text-muted dark:text-muted-dark">
                    Aucune série validée.
                  </Text>
                ) : (
                  activity.completedSets.map(({ set }, position) => (
                    <Text
                      key={position}
                      className="font-mono text-[13px] text-muted dark:text-muted-dark"
                      style={{ fontVariant: ['tabular-nums'] }}
                    >
                      {position + 1}.  {formatSetValues(set.values, (m) => unitOf(m))}
                    </Text>
                  ))
                )}

                {/* Le prévu ne se rappelle que s'il n'a pas été tenu : le
                    dire quand tout est fait n'apprendrait rien. */}
                {prevu !== undefined && activity.completedSets.length < prevu && (
                  <Text className="pt-0.5 font-mono text-[12px] text-planned dark:text-planned-dark">
                    {activity.completedSets.length} sur {prevu} série{prevu > 1 ? 's' : ''} prévue
                    {prevu > 1 ? 's' : ''}
                  </Text>
                )}
              </Card>
            );
          })}
        </View>
      </ScrollView>

      <View className="px-5 pt-2">
        <Button label="Terminer" size="lg" onPress={() => router.replace('/home')} />
      </View>
    </SafeAreaView>
  );
}

/** Un chiffre et ce qu'il compte. */
function Figure({ value, label }: { value: string; label: string }) {
  return (
    <Card className="flex-1 items-center gap-0.5">
      <Text
        className="font-mono-bold text-[18px] text-ink dark:text-ink-dark"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>
      <Text className="text-[11px] text-muted dark:text-muted-dark" numberOfLines={1}>
        {label}
      </Text>
    </Card>
  );
}
