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
  finishActivity,
  correctSet,
  finishWorkoutSession,
  goToNextExercise,
  startActivity,
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
  // La série dont on ajuste les valeurs, ouverte en tapant sa ligne.
  const [editing, setEditing] = useState<number | null>(null);
  // Replié, les séries tiennent sur une ligne de pastilles ; déplié, on
  // retrouve la liste détaillée.
  const [showDetail, setShowDetail] = useState(true);
  const [sheet, setSheet] = useState<
    'none' | 'menu' | 'confirm-cancel' | 'end-of-plan' | 'pick-exercise'
  >('none');
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
  // Reste-t-il un exercice après celui-ci dans le programme ?
  const hasNextExercise =
    activity?.plannedPosition != null &&
    plan !== undefined &&
    activity.plannedPosition + 1 < plan.exercises.length;
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

  /**
   * Le socle de ce qu'on affiche : pendant une série, ce que le plan prévoit
   * pour elle ; pendant le repos, ce qui a été enregistré. La saisie locale ne
   * fait que le recouvrir, le temps que l'écriture aboutisse.
   */
  function baseline(): Record<string, number> {
    if (!performance?.currentSet) return lastSet?.values ?? {};

    const targets = plannedExercise?.sets[sets.length - 1]?.targets;
    if (targets && Object.keys(targets).length > 0) return targets;

    // Hors programme : on reprend la dernière série faite, sinon zéro.
    const previous = [...sets].reverse().find((set) => set.status === 'COMPLETED');
    return (
      previous?.values ??
      Object.fromEntries((performance.measurementIds ?? []).map((id) => [id, 0]))
    );
  }

  // La série en cours n'est plus recouverte par la saisie locale : celle-ci
  // appartient désormais à la série ouverte à l'ajustement, qui est une autre.
  const shown = baseline();

  /** Les valeurs de la série ouverte, recouvertes par la saisie en cours. */
  const editedSet = editing !== null ? sets[editing] : undefined;
  const editedValues = { ...(editedSet?.values ?? {}), ...values };

  /** Ajuster une valeur l'enregistre aussitôt sur la série ouverte. */
  function adjust(measurementId: string, value: number) {
    if (editing === null) return;
    const next = { ...editedValues, [measurementId]: value };
    setValues(next);
    correctSet(editing, next)
      .then(() => setError(null))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }

  /**
   * Ouvre ou referme l'ajustement d'une série.
   *
   * En refermant, on relit la performance : les valeurs ont bien été écrites
   * à chaque ajustement, mais la copie gardée en mémoire, elle, date d'avant.
   */
  function toggleEditing(index: number) {
    setValues({});
    if (editing === index) {
      setEditing(null);
      reload().catch((e) => setError(String(e)));
    } else {
      setEditing(index);
    }
  }

  function closeEditing() {
    setEditing(null);
    setValues({});
  }

  function beginSet() {
    // Aucune valeur à mémoriser : le socle les fournit, la saisie locale
    // repart donc de zéro à chaque série.
    run(async () => {
      closeEditing();
      await startPerformanceSet();
    });
  }

  /**
   * Passer à l'exercice suivant enchaîne directement sur sa première série :
   * le repos en cours est interrompu par le démarrage de la série (§13).
   */
  function nextExercise() {
    // Dernier exercice du programme : plutôt que d'échouer sur un exercice
    // qui n'existe pas, on demande ce qu'on fait de la séance.
    if (!hasNextExercise) {
      setSheet('end-of-plan');
      return;
    }
    run(async () => {
      closeEditing();
      await goToNextExercise();
    });
  }

  /**
   * Démarre un exercice hors programme. Comme pour l'exercice suivant, la
   * première série reste un geste explicite.
   */
  function addExercise(exerciseId: string) {
    run(async () => {
      closeEditing();
      if (activity) await finishActivity();
      await startActivity(exerciseId);
    });
  }

  const menuActions: SheetAction[] = [
    { label: 'Terminer la séance', onPress: () => run(finishWorkoutSession) },
    ...(performance?.currentSet
      ? [{ label: 'Abandonner la série', onPress: () => run(abandonPerformanceSet) }]
      : []),
    ...(activity ? [{ label: "Passer à l'exercice suivant", onPress: nextExercise }] : []),
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
            <ScrollView
              key={activity.performanceId ?? 'none'}
              className="max-h-[40%] shrink grow-0"
              contentContainerClassName="gap-2 px-1 pb-1 pt-0.5"
            >
              {sets.map((set, index) => (
                <SetRow
                  key={`${activity.performanceId}-${index}`}
                  index={index + 1}
                  status={statusOf(set.status)}
                  // Une série déjà enregistrée peut être rouverte pour
                  // corriger ce qu'on a réellement fait.
                  onPress={set.status === 'IN_PROGRESS' ? undefined : () => toggleEditing(index)}
                  selected={editing === index}
                  values={
                    format(
                      editing === index
                        ? editedValues
                        : index === lastSetIndex && !isPast(set)
                          ? shown
                          : set.values,
                    ) || '—'
                  }
                />
              ))}
              {plannedExercise?.sets.slice(nextSetIndex).map((set, index) => (
                <SetRow
                  key={`${activity.performanceId}-planned-${index}`}
                  index={nextSetIndex + index + 1}
                  status="planned"
                  values={format(set.targets)}
                />
              ))}
            </ScrollView>
          ) : (
            <ScrollView
              key={activity.performanceId ?? 'none'}
              horizontal
              showsHorizontalScrollIndicator={false}
              className="max-h-12 grow-0"
              contentContainerClassName="gap-2 px-1 pr-4"
            >
              {sets.map((set, index) => (
                <SetChip
                  key={`${activity.performanceId}-${index}`}
                  index={index + 1}
                  status={statusOf(set.status)}
                  // La série ajustée montre la valeur en cours, sans attendre
                  // le prochain rechargement.
                  values={formatShort(index === lastSetIndex && !isPast(set) ? shown : set.values) || '—'}
                />
              ))}
              {plannedExercise?.sets.slice(nextSetIndex).map((set, index) => (
                <SetChip
                  key={`${activity.performanceId}-planned-${index}`}
                  index={nextSetIndex + index + 1}
                  status="planned"
                  values={formatShort(set.targets)}
                />
              ))}
            </ScrollView>
          )}

          {/* Le chrono occupe le centre de l'écran pendant la récupération. */}
          <View className="flex-1 items-center justify-center">
            {resting && <Timer seconds={restElapsed} large />}
          </View>

          <View className="gap-3 pb-2">
            {error && <BusinessNotice message={error} />}

            {/* Les champs n'apparaissent que pour la série qu'on a ouverte. */}
            {editing !== null && editedSet && (
              <View className="flex-row gap-3">
                {(performance?.measurementIds ?? []).map((id) => (
                  <NumberField
                    key={id}
                    unit={unitOf(id)}
                    value={editedValues[id] ?? 0}
                    step={STEPS[id] ?? 1}
                    onChange={(value) => adjust(id, value)}
                  />
                ))}
              </View>
            )}

            {performance?.currentSet && (
              <Button
                label="Terminer"
                size="lg"
                onPress={() => run(() => completePerformanceSet(shown))}
              />
            )}

            {/* Hors série en cours, toujours deux choix : lancer la série,
                ou passer à l'exercice suivant. Le principal dépend de l'état
                du programme. */}
            {!performance?.currentSet && (
              <View className="flex-row gap-3">
                <Button
                  label={plannedDone ? 'Nouvelle série' : 'Démarrer'}
                  variant={plannedDone ? 'secondary' : 'primary'}
                  size="lg"
                  className="flex-1"
                  onPress={beginSet}
                />
                <Button
                  label="Suivant"
                  variant={plannedDone ? 'primary' : 'secondary'}
                  size="lg"
                  className="flex-1"
                  onPress={nextExercise}
                />
              </View>
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
      <Sheet
        visible={sheet === 'menu'}
        title="Séance"
        actions={menuActions}
        onClose={() => setSheet('none')}
      />
      <Sheet
        visible={sheet === 'end-of-plan'}
        title="Programme terminé"
        description="Tous les exercices prévus sont faits. Tu peux t'arrêter là ou continuer librement."
        actions={[
          { label: 'Terminer la séance', onPress: () => run(finishWorkoutSession) },
          { label: 'Ajouter un exercice', onPress: () => setSheet('pick-exercise') },
        ]}
        onClose={() => setSheet('none')}
      />
      <Sheet
        visible={sheet === 'pick-exercise'}
        title="Ajouter un exercice"
        description="Hors programme : ses séries seront enregistrées normalement."
        actions={exercises.map((exercise) => ({
          label: exercise.name,
          onPress: () => addExercise(exercise.id),
        }))}
        searchPlaceholder="Rechercher un exercice"
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

/** Une série close et non ajustée : ses valeurs enregistrées font foi. */
function isPast(set: { status: string }): boolean {
  return set.status === 'ABANDONED';
}

function statusOf(status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED'): SetRowStatus {
  if (status === 'COMPLETED') return 'completed';
  if (status === 'ABANDONED') return 'abandoned';
  return 'in-progress';
}
