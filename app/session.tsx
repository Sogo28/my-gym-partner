import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { Sheet, type SheetAction } from '../src/ui/sheet';
import { SetChip } from '../src/ui/set-chip';
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
  // Replié, les séries tiennent sur une ligne de pastilles ; déplié, on
  // retrouve la liste détaillée.
  const [showDetail, setShowDetail] = useState(false);
  const [sheet, setSheet] = useState<'none' | 'menu' | 'confirm-cancel'>('none');
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
  const completedCount = sets.filter((set) => set.status === 'COMPLETED').length;
  // Toutes les séries prévues sont faites : la suivante serait une série en
  // plus du plan. Un exercice hors programme est dans ce cas dès le départ.
  const plannedDone = !plannedExercise || nextSetIndex >= plannedExercise.sets.length;
  const totalSets = Math.max(sets.length, plannedExercise?.sets.length ?? 0);

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
  /** Version courte pour les pastilles : "12s", "8reps·20kg". */
  const formatShort = (v: Record<string, number>) =>
    Object.entries(v)
      .map(([id, value]) => `${value}${unitOf(id)}`)
      .join('·');

  // Ce qu'on affiche vient d'abord de la série enregistrée : la saisie locale
  // ne fait que la recouvrir, le temps que l'écriture aboutisse.
  const shown = { ...(lastSet?.values ?? {}), ...values };

  /** Ajuster une valeur pendant le repos l'enregistre aussitôt. */
  function adjust(measurementId: string, value: number) {
    const next = { ...shown, [measurementId]: value };
    setValues(next);
    if (lastSetIndex >= 0) {
      correctSet(lastSetIndex, next)
        .then(() => setError(null))
        .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    }
  }

  function beginSet() {
    // La série démarre avec les valeurs prévues. À défaut de plan, on reprend
    // la dernière série faite, sinon zéro : une série complétée doit toujours
    // porter une valeur.
    const targets = plannedExercise?.sets[nextSetIndex]?.targets;
    const fallback = Object.fromEntries(
      (performance?.measurementIds ?? []).map((id) => [id, lastSet?.values[id] ?? 0]),
    );
    run(async () => {
      await startPerformanceSet();
      setValues({ ...fallback, ...(targets ?? {}) });
    });
  }

  const menuActions: SheetAction[] = [
    { label: 'Terminer la séance', onPress: () => run(finishWorkoutSession) },
    ...(performance?.currentSet
      ? [{ label: 'Abandonner la série', onPress: () => run(abandonPerformanceSet) }]
      : []),
    ...(activity ? [{ label: "Passer à l'exercice suivant", onPress: () => run(goToNextExercise) }] : []),
    { label: 'Annuler la séance', tone: 'danger' as const, onPress: () => setSheet('confirm-cancel') },
  ];

  if (!session) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 justify-center gap-4 bg-background p-5 dark:bg-background-dark">
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
      </SafeAreaView>
    );
  }

  const position =
    activity?.plannedPosition != null && plan
      ? `exercice ${activity.plannedPosition + 1}/${plan.exercises.length} · série ${nextSetIndex + (performance?.currentSet ? 0 : 1)} sur ${plannedExercise?.sets.length ?? '—'}`
      : 'séance libre';

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background px-5 pb-2 pt-4 dark:bg-background-dark">
      <SessionHeader
        workoutName={plan ? plan.name : 'Séance libre'}
        position={position}
        onMenu={() => setSheet('menu')}
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
            onPress={() => setShowDetail((v) => !v)}
            className="mt-6 flex-row items-center justify-between py-2"
          >
            <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
              Séries {completedCount}/{totalSets || '—'}
            </Text>
            <Text className="font-mono text-[12px] text-muted dark:text-muted-dark">
              {showDetail ? 'réduire ⌃' : 'détail ⌄'}
            </Text>
          </Pressable>

          {showDetail ? (
            <ScrollView className="max-h-[40%] shrink grow-0" contentContainerClassName="gap-2 pb-1">
              {sets.map((set, index) => (
                <SetRow
                  key={index}
                  index={index + 1}
                  status={statusOf(set.status)}
                  values={format(index === lastSetIndex && resting ? shown : set.values) || '—'}
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
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="max-h-12 grow-0"
              contentContainerClassName="gap-2 pr-4"
            >
              {sets.map((set, index) => (
                <SetChip
                  key={index}
                  index={index + 1}
                  status={statusOf(set.status)}
                  // La série ajustée montre la valeur en cours, sans attendre
                  // le prochain rechargement.
                  values={formatShort(index === lastSetIndex && resting ? shown : set.values) || '—'}
                />
              ))}
              {plannedExercise?.sets.slice(nextSetIndex).map((set, index) => (
                <SetChip
                  key={`planned-${index}`}
                  index={nextSetIndex + index + 1}
                  status="planned"
                  values={formatShort(set.targets)}
                />
              ))}
            </ScrollView>
          )}

          {/* L'action du moment occupe le centre de l'écran, à portée de pouce
              et sans rien d'autre autour. */}
          <View className="flex-1 items-center justify-center gap-4">
            {resting && <Timer seconds={restElapsed} large />}

            {performance?.currentSet && (
              <Pressable
                onPress={() => run(() => completePerformanceSet(shown))}
                className="h-64 w-64 items-center justify-center rounded-full bg-primary active:bg-primary-pressed"
              >
                <Text className="font-black uppercase text-[28px] tracking-tight text-ink">
                  Terminer
                </Text>
              </Pressable>
            )}
          </View>

          <View className="gap-3 pb-2">
            {error && <BusinessNotice message={error} />}

            {resting && (
              <View className="flex-row gap-3">
                {(performance?.measurementIds ?? []).map((id) => (
                  <NumberField
                    key={id}
                    unit={unitOf(id)}
                    value={shown[id] ?? 0}
                    step={STEPS[id] ?? 1}
                    onChange={(value) => adjust(id, value)}
                  />
                ))}
              </View>
            )}

            {!performance?.currentSet &&
              (plannedDone ? (
                // Le plan est honoré : continuer devient un choix entre
                // ajouter une série et passer à la suite.
                <View className="flex-row gap-3">
                  <Button
                    label="Ajouter une série"
                    size="lg"
                    className="flex-1"
                    onPress={beginSet}
                  />
                  <Button
                    label="Exercice suivant"
                    variant="secondary"
                    size="lg"
                    className="flex-1"
                    onPress={() => run(goToNextExercise)}
                  />
                </View>
              ) : (
                <Button
                  label={resting ? 'Série suivante' : `Série ${nextSetIndex + 1}`}
                  size="xl"
                  onPress={beginSet}
                />
              ))}
          </View>
        </>
      ) : (
        <View className="mt-auto gap-3">
          {error && <BusinessNotice message={error} />}
          <Text className="text-muted dark:text-muted-dark">Aucun exercice en cours.</Text>
          <Button label="Terminer la séance" size="lg" onPress={() => run(finishWorkoutSession)} />
        </View>
      )}
      <Sheet
        visible={sheet === 'menu'}
        title="Séance"
        actions={menuActions}
        onClose={() => setSheet('none')}
      />
      <Sheet
        visible={sheet === 'confirm-cancel'}
        title="Annuler la séance ?"
        description="Les séries déjà validées seront conservées dans ton historique."
        actions={[
          {
            label: 'Annuler la séance',
            tone: 'danger',
            onPress: () => run(cancelWorkoutSession),
          },
        ]}
        onClose={() => setSheet('none')}
      />
    </SafeAreaView>
  );
}

function statusOf(status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED'): SetRowStatus {
  if (status === 'COMPLETED') return 'completed';
  if (status === 'ABANDONED') return 'abandoned';
  return 'in-progress';
}
