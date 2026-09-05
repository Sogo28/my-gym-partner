import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import type { Exercise } from '../src/domain/exercise/exercise';
import type { Measurement } from '../src/domain/exercise/measurement';
import type { ExercisePerformance } from '../src/domain/performance/exercise-performance';
import type { PlannedWorkout } from '../src/domain/planned-workout/planned-workout';
import type { WorkoutSession } from '../src/domain/workout-session/workout-session';
import { findAll as findAllExercises, findAllMeasurements } from '../src/infra/exercise-repository';
import { findById as findPerformanceById } from '../src/infra/performance-repository';
import { findAll as findAllPlans } from '../src/infra/planned-workout-repository';
import { findActive } from '../src/infra/workout-session-repository';
import { Button } from '../src/ui/button';
import { EmptyState } from '../src/ui/empty-state';
import { BusinessNotice } from '../src/ui/notice';
import { SessionHeader } from '../src/ui/screen-header';
import { SetRow, type SetRowStatus } from '../src/ui/set-row';
import { NumberField } from '../src/ui/number-field';
import { Timer } from '../src/ui/timer';
import {
  abandonPerformanceSet,
  cancelWorkoutSession,
  completePerformanceSet,
  correctSet,
  finishWorkoutSession,
  goToNextExercise,
  startPerformanceSet,
  startWorkoutSession,
} from '../src/use-cases/workout-session-actions';

/** Le pas d'ajustement dépend de la mesure : on n'ajoute pas 1 kg comme 1 rep. */
const STEPS: Record<string, number> = { reps: 1, weight: 2.5, duration: 1, distance: 10 };

export default function SessionScreen() {
  const router = useRouter();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [performance, setPerformance] = useState<ExercisePerformance | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [plans, setPlans] = useState<PlannedWorkout[]>([]);
  const [values, setValues] = useState<Record<string, number>>({});
  const [showSets, setShowSets] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [active, allExercises, allPlans, allMeasurements] = await Promise.all([
      findActive(),
      findAllExercises(),
      findAllPlans(),
      findAllMeasurements(),
    ]);
    setSession(active);
    setExercises(allExercises);
    setPlans(allPlans);
    setMeasurements(allMeasurements);

    const performanceId = active?.currentActivity?.performanceId ?? null;
    setPerformance(performanceId ? await findPerformanceById(performanceId) : null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload().catch((e) => setError(String(e)));
    }, [reload]),
  );

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
      await reload();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const plan = plans.find((p) => p.id === session?.plannedWorkoutId);
  const activity = session?.currentActivity;
  const plannedExercise =
    activity?.plannedPosition != null ? plan?.exercises[activity.plannedPosition] : undefined;

  const sets = performance?.sets ?? [];
  const nextSetIndex = sets.length;
  const lastSetIndex = nextSetIndex - 1;
  const lastSet = lastSetIndex >= 0 ? sets[lastSetIndex] : undefined;
  const resting = Boolean(session?.currentRest);

  // Pendant le repos, les champs affichent ce qui vient d'être enregistré.
  useEffect(() => {
    if (resting && lastSet) setValues({ ...lastSet.values });
  }, [resting, lastSetIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Un rendu par seconde, et seulement pendant le repos.
  const restStartedAt = session?.currentRest?.startedAt.getTime() ?? null;
  const [, setTick] = useState(0);
  useEffect(() => {
    if (restStartedAt === null) return;
    const interval = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, [restStartedAt]);
  const restElapsed = restStartedAt === null ? 0 : Math.floor((Date.now() - restStartedAt) / 1000);

  const unitOf = (id: string) => measurements.find((m) => m.id === id)?.unit ?? id;
  const nameOf = (id: string) => exercises.find((e) => e.id === id)?.name ?? id;
  const format = (v: Record<string, number>) =>
    Object.entries(v)
      .map(([id, value]) => `${value} ${unitOf(id)}`)
      .join(' · ');

  const diverges =
    lastSet !== undefined &&
    Object.entries(values).some(([id, value]) => lastSet.values[id] !== value);

  function beginSet() {
    run(async () => {
      await startPerformanceSet();
      setValues({ ...(plannedExercise?.sets[nextSetIndex]?.targets ?? {}) });
    });
  }

  function openMenu() {
    const options: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [
      { text: 'Terminer la séance', onPress: () => run(finishWorkoutSession) },
    ];
    if (performance?.currentSet) {
      options.push({ text: 'Abandonner la série', onPress: () => run(abandonPerformanceSet) });
    }
    if (activity) {
      options.push({ text: "Passer l'exercice", onPress: () => run(goToNextExercise) });
    }
    options.push({
      text: 'Annuler la séance',
      style: 'destructive',
      onPress: () =>
        Alert.alert('Annuler la séance ?', 'Les séries déjà validées seront conservées.', [
          { text: 'Continuer', style: 'cancel' },
          { text: 'Annuler la séance', style: 'destructive', onPress: () => run(cancelWorkoutSession) },
        ]),
    });
    options.push({ text: 'Fermer', style: 'cancel' });

    Alert.alert('Séance', undefined, options);
  }

  if (!session) {
    return (
      <View className="flex-1 justify-center gap-4 bg-background p-5 dark:bg-background-dark">
        <EmptyState
          title="Aucune séance en cours"
          description="Choisis un entraînement pour démarrer, ou lance une séance libre."
          actionLabel="Choisir un entraînement"
          onAction={() => router.push('/workouts')}
        />
        <Button
          label="Séance libre"
          variant="ghost"
          size="md"
          onPress={() => run(() => startWorkoutSession())}
        />
        {error && <BusinessNotice message={error} />}
      </View>
    );
  }

  const position =
    activity?.plannedPosition != null && plan
      ? `exercice ${activity.plannedPosition + 1}/${plan.exercises.length} · série ${nextSetIndex + (performance?.currentSet ? 0 : 1)} sur ${plannedExercise?.sets.length ?? '—'}`
      : 'séance libre';

  return (
    <View className="flex-1 bg-background px-5 pb-2 pt-2 dark:bg-background-dark">
      <SessionHeader
        workoutName={plan ? plan.name : 'Séance libre'}
        position={position}
        onMenu={openMenu}
      />

      {activity ? (
        <>
          <Text
            className="font-black uppercase text-display tracking-tighter text-ink dark:text-ink-dark"
            numberOfLines={2}
          >
            {nameOf(activity.exerciseId)}
          </Text>
          <Text className="mt-2 font-mono text-[13px] text-muted dark:text-muted-dark">
            {(performance?.measurementIds ?? []).map(unitOf).join(' · ')}
          </Text>

          <Pressable
            onPress={() => setShowSets((v) => !v)}
            className="mt-6 flex-row items-center justify-between py-2"
          >
            <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
              Séries
            </Text>
            <Text className="font-mono text-[12px] text-muted dark:text-muted-dark">
              {showSets ? 'replier ⌃' : 'déplier ⌄'}
            </Text>
          </Pressable>

          {showSets && (
            <ScrollView className="shrink" contentContainerClassName="gap-2 pb-1">
              {sets.map((set, index) => (
                <SetRow
                  key={index}
                  index={index + 1}
                  status={statusOf(set.status)}
                  values={format(set.values) || '—'}
                />
              ))}
              {plannedExercise?.sets.slice(nextSetIndex).map((set, index) => (
                <SetRow
                  key={`planned-${index}`}
                  index={nextSetIndex + index + 1}
                  status="planned"
                  values={format(set.targets)}
                />
              ))}
            </ScrollView>
          )}

          <View className="mt-auto gap-3 pt-4">
            {error && <BusinessNotice message={error} />}

            {resting && (
              <View className="flex-row items-start gap-4">
                <Timer seconds={restElapsed} />
                <View className="flex-1 flex-row gap-3">
                  {(performance?.measurementIds ?? []).map((id) => (
                    <NumberField
                      key={id}
                      unit={unitOf(id)}
                      value={values[id] ?? 0}
                      planned={plannedExercise?.sets[lastSetIndex]?.targets[id]}
                      step={STEPS[id] ?? 1}
                      onChange={(value) => setValues((current) => ({ ...current, [id]: value }))}
                    />
                  ))}
                </View>
              </View>
            )}

            {resting && diverges && (
              <Button
                label={`Corriger la série ${lastSetIndex + 1}`}
                variant="secondary"
                size="md"
                onPress={() => run(() => correctSet(lastSetIndex, values))}
              />
            )}

            {performance?.currentSet ? (
              <Button
                label={`Terminer la série ${nextSetIndex}`}
                size="2xl"
                onPress={() => run(() => completePerformanceSet(values))}
              />
            ) : (
              <>
                <Button
                  label={resting ? 'Série suivante' : `Série ${nextSetIndex + 1}`}
                  size="xl"
                  onPress={beginSet}
                />
                <Button
                  label="Exercice suivant"
                  variant="secondary"
                  size="md"
                  onPress={() => run(goToNextExercise)}
                />
              </>
            )}
          </View>
        </>
      ) : (
        <View className="mt-auto gap-3">
          {error && <BusinessNotice message={error} />}
          <Text className="text-muted dark:text-muted-dark">Aucun exercice en cours.</Text>
          <Button label="Terminer la séance" size="lg" onPress={() => run(finishWorkoutSession)} />
        </View>
      )}
    </View>
  );
}

function statusOf(status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED'): SetRowStatus {
  if (status === 'COMPLETED') return 'completed';
  if (status === 'ABANDONED') return 'abandoned';
  return 'in-progress';
}
