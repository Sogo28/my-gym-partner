import { useFocusEffect, useRouter } from 'expo-router';
import { messageOf } from '../src/ui/message';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Exercise } from '../src/domain/exercise/exercise';
import type { Measurement } from '../src/domain/exercise/measurement';
import type {
  ExercisePerformance,
  Side,
  ValuesBySide,
} from '../src/domain/performance/exercise-performance';
import type { PlannedWorkout } from '../src/domain/planned-workout/planned-workout';
import type { WorkoutSession } from '../src/domain/workout-session/workout-session';
import { findAll as findAllExercises, findAllMeasurements } from '../src/infra/exercise-repository';
import { findById as findPerformanceById } from '../src/infra/performance-repository';
import { findAll as findAllPlans } from '../src/infra/planned-workout-repository';
import type { ScheduledWorkout } from '../src/domain/scheduling/scheduled-workout';
import {
  cancelScheduledWorkout,
  listSchedule,
  rescheduleWorkout,
} from '../src/use-cases/scheduling-actions';
import { findActive } from '../src/infra/workout-session-repository';
import { Button } from '../src/ui/button';
import { Card } from '../src/ui/card';
import { DatePickerSheet } from '../src/ui/date-picker';
import { EmptyState } from '../src/ui/empty-state';
import { BusinessNotice } from '../src/ui/notice';
import { SectionHeader, SessionHeader } from '../src/ui/screen-header';
import { Sheet, type SheetAction } from '../src/ui/sheet';
import { SetChip } from '../src/ui/set-chip';
import { SetRow, type SetRowStatus } from '../src/ui/set-row';
import { NumberField } from '../src/ui/number-field';
import { Timer } from '../src/ui/timer';
import { formatSetValues, formatSetValuesShort } from '../src/ui/set-values';
import { formatDateTime } from '../src/ui/format';
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
  startRest,
  startWorkoutSession,
  stopRest,
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
  const [schedule, setSchedule] = useState<ScheduledWorkout[]>([]);
  /** L'entraînement programmé qu'on est en train de déplacer. */
  const [moving, setMoving] = useState<ScheduledWorkout | null>(null);
  const [values, setValues] = useState<ValuesBySide>({});
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
    const [active, allExercises, allPlans, allMeasurements, allSchedule] = await Promise.all([
      findActive(),
      findAllExercises(),
      findAllPlans(),
      findAllMeasurements(),
      listSchedule(),
    ]);
    setSession(active);
    setExercises(allExercises);
    setPlans(allPlans);
    setMeasurements(allMeasurements);
    // Seules les intentions encore ouvertes intéressent l'écran.
    setSchedule(allSchedule.filter((entry) => entry.status === 'SCHEDULED'));

    const performanceId = active?.currentActivity?.performanceId ?? null;
    setPerformance(performanceId ? await findPerformanceById(performanceId) : null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload().catch((e) => setError(messageOf(e)));
    }, [reload]),
  );

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
      await reload();
      setError(null);
    } catch (e) {
      setError(messageOf(e));
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
  const format = (v: ValuesBySide) => formatSetValues(v, unitOf);
  const formatShort = (v: ValuesBySide) => formatSetValuesShort(v, unitOf);

  /**
   * Les côtés à saisir. Un exercice unilatéral en a deux : c'est UNE série
   * qui porte les deux, pas deux séries (§4).
   */
  const currentExercise = exercises.find((e) => e.id === activity?.exerciseId);
  const sides: Side[] = currentExercise?.isUnilateral ? ['LEFT', 'RIGHT'] : ['BOTH'];
  const SIDE_LABELS: Record<string, string> = {
    BOTH: '',
    LEFT: 'Côté gauche',
    RIGHT: 'Côté droit',
  };

  /** Les mêmes cibles s'appliquent à chaque côté : le plan ne les distingue pas. */
  const spreadOverSides = (targets: Record<string, number>): ValuesBySide =>
    Object.fromEntries(sides.map((side) => [side, targets]));

  /**
   * Le socle de ce qu'on affiche : pendant une série, ce que le plan prévoit
   * pour elle ; pendant le repos, ce qui a été enregistré. La saisie locale ne
   * fait que le recouvrir, le temps que l'écriture aboutisse.
   */
  function baseline(): ValuesBySide {
    if (!performance?.currentSet) return lastSet?.values ?? {};

    const targets = plannedExercise?.sets[sets.length - 1]?.targets;
    if (targets && Object.keys(targets).length > 0) return spreadOverSides(targets);

    // Hors programme : on reprend la dernière série faite, sinon zéro.
    const previous = [...sets].reverse().find((set) => set.status === 'COMPLETED');
    return (
      previous?.values ??
      spreadOverSides(Object.fromEntries((performance.measurementIds ?? []).map((id) => [id, 0])))
    );
  }

  // La série en cours n'est plus recouverte par la saisie locale : celle-ci
  // appartient désormais à la série ouverte à l'ajustement, qui est une autre.
  const shown = baseline();

  /** Les valeurs de la série ouverte, recouvertes par la saisie en cours. */
  const editedSet = editing !== null ? sets[editing] : undefined;
  const editedValues = { ...(editedSet?.values ?? {}), ...values };

  /** Ajuster une valeur l'enregistre aussitôt sur la série ouverte. */
  function adjust(side: Side, measurementId: string, value: number) {
    if (editing === null) return;
    const next = {
      ...editedValues,
      [side]: { ...(editedValues[side] ?? {}), [measurementId]: value },
    };
    setValues(next);
    correctSet(editing, next)
      .then(() => setError(null))
      .catch((e) => setError(messageOf(e)));
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
      reload().catch((e) => setError(messageOf(e)));
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
    // Le repos s'enchaîne tout seul après une série ; ici on le commande à
    // la main, pour souffler avant d'attaquer ou pour couper court.
    ...(session?.currentRest
      ? [{ label: 'Arrêter le repos', onPress: () => run(stopRest) }]
      : [{ label: 'Démarrer un repos', onPress: () => run(startRest) }]),
    { label: 'Annuler la séance', tone: 'danger' as const, onPress: () => setSheet('confirm-cancel') },
  ];

  if (!session) {
    const now = new Date();
    const isToday = (date: Date) => date.toDateString() === now.toDateString();
    const overdue = schedule.filter((entry) => entry.isOverdue(now) && !isToday(entry.scheduledAt));
    const today = schedule.filter((entry) => isToday(entry.scheduledAt));
    const upcoming = schedule.filter((entry) => entry.scheduledAt > now && !isToday(entry.scheduledAt));

    const planNameOf = (id: string) => plans.find((plan) => plan.id === id)?.name ?? id;

    const entryCard = (entry: ScheduledWorkout, note?: string) => (
      <Card key={entry.id} density="titled" className="gap-2">
        <View className="flex-row items-start justify-between gap-3">
          <View className="shrink">
            <Text className="font-extrabold text-[17px] text-ink dark:text-ink-dark">
              {planNameOf(entry.plannedWorkoutId)}
            </Text>
            <Text className="font-mono text-[12px] text-muted dark:text-muted-dark">
              {note ?? formatDateTime(entry.scheduledAt)}
            </Text>
          </View>
          <View className="flex-row gap-3 pt-1">
            <Pressable onPress={() => setMoving(entry)} hitSlop={8}>
              <Text className="text-[13px] text-primary-ink dark:text-primary-ink-dark">
                déplacer
              </Text>
            </Pressable>
            <Pressable onPress={() => run(() => cancelScheduledWorkout(entry))} hitSlop={8}>
              <Text className="text-[13px] text-danger dark:text-danger-dark">annuler</Text>
            </Pressable>
          </View>
        </View>
        <Button
          label="Démarrer"
          size="md"
          onPress={() => run(() => startWorkoutSession(entry.plannedWorkoutId, entry.id))}
        />
      </Card>
    );

    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
        <View className="px-5 pt-4">
          <SectionHeader
            title="Séance"
            subtitle={
              schedule.length > 0
                ? `${schedule.length} entraînement${schedule.length > 1 ? 's' : ''} programmé${schedule.length > 1 ? 's' : ''}`
                : 'aucune séance en cours'
            }
          />
        </View>

        <ScrollView contentContainerClassName="gap-3 px-5 pb-4">
          {error && <BusinessNotice message={error} />}

          {today.length > 0 && (
            <>
              <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
                Aujourd'hui
              </Text>
              {today.map((entry) => entryCard(entry, "aujourd'hui"))}
            </>
          )}

          {/* En retard, jamais "manqué" : la séance reste à faire. */}
          {overdue.length > 0 && (
            <>
              <Text className="mt-2 font-bold uppercase text-label text-muted dark:text-muted-dark">
                En retard
              </Text>
              {overdue.map((entry) => entryCard(entry))}
            </>
          )}

          {upcoming.length > 0 && (
            <>
              <Text className="mt-2 font-bold uppercase text-label text-muted dark:text-muted-dark">
                À venir
              </Text>
              {upcoming.map((entry) => entryCard(entry))}
            </>
          )}

          {schedule.length === 0 && (
            <EmptyState
              title="Aucune séance en cours"
              description="Programme un entraînement depuis sa fiche, ou démarre directement."
            />
          )}
        </ScrollView>

        <DatePickerSheet
          visible={moving !== null}
          title="Déplacer cette séance"
          confirmLabel="Déplacer"
          initial={moving?.scheduledAt}
          onConfirm={(date) => {
            const entry = moving;
            setMoving(null);
            if (entry) run(() => rescheduleWorkout(entry, date));
          }}
          onClose={() => setMoving(null)}
        />

        <View className="gap-2 px-5 pb-2">
          <Button
            label="Choisir un entraînement"
            variant="secondary"
            size="md"
            onPress={() => router.push('/workouts')}
          />
          <Button
            label="Séance libre"
            variant="ghost"
            size="md"
            onPress={() => run(() => startWorkoutSession())}
          />
        </View>
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

            {/* Les champs n'apparaissent que pour la série qu'on a ouverte.
                Un exercice unilatéral en montre une rangée par côté. */}
            {editing !== null &&
              editedSet &&
              sides.map((side) => (
                <View key={side} className="gap-1">
                  {SIDE_LABELS[side] ? (
                    <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
                      {SIDE_LABELS[side]}
                    </Text>
                  ) : null}
                  <View className="flex-row gap-3">
                    {(performance?.measurementIds ?? []).map((id) => (
                      <NumberField
                        key={id}
                        unit={unitOf(id)}
                        value={editedValues[side]?.[id] ?? 0}
                        step={STEPS[id] ?? 1}
                        onChange={(value) => adjust(side, id, value)}
                      />
                    ))}
                  </View>
                </View>
              ))}

            {performance?.currentSet && (
              <Button
                label="Terminer"
                size="lg"
                onPress={() => run(() => completePerformanceSet(shown))}
              />
            )}

            {/* Hors série en cours : lancer la série suivante. Passer à
                l'exercice suivant ne s'offre qu'une fois le programme de
                celui-ci épuisé -- au milieu des séries prévues, ce serait
                proposer d'abandonner ce qu'on est en train de faire. Le menu
                garde l'échappatoire pour les jours où l'on écourte. */}
            {!performance?.currentSet && (
              <View className="flex-row gap-3">
                <Button
                  label={plannedDone ? 'Nouvelle série' : 'Démarrer'}
                  variant={plannedDone ? 'secondary' : 'primary'}
                  size="lg"
                  className="flex-1"
                  onPress={beginSet}
                />
                {plannedDone && (
                  <Button
                    label="Suivant"
                    size="lg"
                    className="flex-1"
                    onPress={nextExercise}
                  />
                )}
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
        // La liste complète sert à nommer les exercices déjà faits ; on ne
        // propose en revanche que ceux encore au catalogue.
        actions={exercises
          .filter((exercise) => !exercise.isArchived)
          .map((exercise) => ({
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
