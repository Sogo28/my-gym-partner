import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Exercise } from '../src/domain/exercise/exercise';
import type { Measurement } from '../src/domain/exercise/measurement';
import type { Muscle } from '../src/domain/exercise/muscle';
import type { Side, ValuesBySide } from '../src/domain/performance/exercise-performance';
import type { PlannedWorkout } from '../src/domain/planned-workout/planned-workout';
import { findAllMeasurements, findAllMuscles } from '../src/infra/exercise-repository';
import { findRecentExerciseIds } from '../src/infra/performance-repository';
import { Button } from '../src/ui/button';
import { Card } from '../src/ui/card';
import { Collapsible } from '../src/ui/collapsible';
import { takeCreated } from '../src/ui/created-exercise';
import { DatePickerSheet } from '../src/ui/date-picker';
import { ExercisePicker } from '../src/ui/exercise-picker';
import { Fab } from '../src/ui/fab';
import { formatDateTime } from '../src/ui/format';
import { MeasureField } from '../src/ui/measure-field';
import { messageOf } from '../src/ui/message';
import { useNotifications } from '../src/ui/notifications';
import { BackHeader } from '../src/ui/screen-header';
import { defaultTargets } from '../src/ui/set-defaults';
import { formatSetValues } from '../src/ui/set-values';
import { Sheet } from '../src/ui/sheet';
import { ladder, Wheel } from '../src/ui/wheel';
import { listActiveExercises, listActiveWorkouts } from '../src/use-cases/edit-catalogue';
import { logPastSession } from '../src/use-cases/log-session';
import { catalogueSource } from '../src/use-cases/repdb-actions';

/** Une heure : ce qu'on suppose avoir passé à la salle tant qu'on ne l'a pas dit. */
const DEFAULT_DURATION = 3600;

/** Un exercice du brouillon, et ses séries telles qu'on les déclare. */
type Done = { key: string; exerciseId: string; sets: ValuesBySide[] };

/**
 * Enregistrer une séance qu'on a déjà faite.
 *
 * L'autre bout de l'écran de séance. Celui-ci accompagne l'effort minute par
 * minute ; celui-là recueille le souvenir, une fois rentré. On y déclare ce
 * dont on se souvient -- le jour, la durée, les exercices, les séries -- et
 * rien de ce qu'on ne peut pas savoir : ni le temps de chaque série, ni les
 * repos. Une séance enregistrée ici vaut ensuite exactement une séance
 * vécue : même historique, mêmes records, mêmes objectifs.
 *
 * Le brouillon vit dans l'écran : rien n'est écrit avant le bouton du bas.
 */
export default function LogSessionScreen() {
  const { notify } = useNotifications();
  const router = useRouter();

  const [available, setAvailable] = useState<Exercise[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [muscles, setMuscles] = useState<Muscle[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [plans, setPlans] = useState<PlannedWorkout[]>([]);

  /**
   * Par défaut, la séance vient de se finir : on part d'il y a une heure,
   * pour une heure. Les deux réglages composent alors « j'ai terminé à
   * l'instant », qui est le cas le plus courant -- on enregistre en rentrant.
   */
  const [at, setAt] = useState(() => new Date(Date.now() - DEFAULT_DURATION * 1000));
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_DURATION);
  const [draft, setDraft] = useState<Done[]>([]);
  /** L'entraînement dont on est parti, s'il y en a un. */
  const [from, setFrom] = useState<PlannedWorkout | null>(null);

  const [sheet, setSheet] = useState<'none' | 'when' | 'duration' | 'plans'>('none');
  const [picking, setPicking] = useState(false);
  const [editingSet, setEditingSet] = useState<{ key: string; setIndex: number } | null>(null);
  const [saving, setSaving] = useState(false);

  /** L'exercice qu'on vient de créer, coché d'avance à la réouverture. */
  const [preselected, setPreselected] = useState<string[]>([]);
  const pendingSelection = useRef<string[]>([]);
  const nextKey = useRef(0);
  const keyed = (exerciseId: string, sets: ValuesBySide[]): Done => ({
    key: String(nextKey.current++),
    exerciseId,
    sets,
  });

  useFocusEffect(
    useCallback(() => {
      Promise.all([
        listActiveExercises(),
        findAllMeasurements(),
        findAllMuscles(),
        findRecentExerciseIds(),
        listActiveWorkouts(),
      ])
        .then(([exercises, allMeasurements, allMuscles, recent, allPlans]) => {
          setAvailable(exercises);
          setMeasurements(allMeasurements);
          setMuscles(allMuscles);
          setRecentIds(recent);
          setPlans(allPlans);
        })
        .catch((e) => notify(messageOf(e)));

      // Revenir du formulaire d'exercice reprend le geste interrompu, comme
      // à la création d'un entraînement.
      const created = takeCreated();
      if (created) {
        setPreselected([...pendingSelection.current, created]);
        pendingSelection.current = [];
        setPicking(true);
      }
    }, []),
  );

  const catalogue = useMemo(
    () =>
      catalogueSource(() => {
        listActiveExercises().then(setAvailable).catch((e) => notify(messageOf(e)));
      }),
    [],
  );

  const exerciseOf = (id: string) => available.find((candidate) => candidate.id === id);
  const unitOf = (id: string) => measurements.find((m) => m.id === id)?.unit ?? id;

  /**
   * Les côtés d'une série. Un exercice unilatéral en a deux : c'est UNE série
   * qui porte les deux, pas deux séries (§4).
   */
  const sidesOf = (exercise: Exercise): Side[] =>
    exercise.isUnilateral ? ['LEFT', 'RIGHT'] : ['BOTH'];

  /** Les mêmes valeurs de départ de chaque côté : à corriger là où ils diffèrent. */
  const overSides = (exercise: Exercise, values: Record<string, number>): ValuesBySide =>
    Object.fromEntries(sidesOf(exercise).map((side) => [side, { ...values }]));

  const firstSet = (exercise: Exercise): ValuesBySide =>
    overSides(exercise, defaultTargets(exercise.measurementIds));

  const editingEntry = editingSet ? draft.find((entry) => entry.key === editingSet.key) : undefined;
  const editingExercise = editingEntry ? exerciseOf(editingEntry.exerciseId) : undefined;
  const editedValues = editingEntry?.sets[editingSet?.setIndex ?? -1];
  /**
   * Une seule mesure : la roulette EST tout le réglage, et la feuille se
   * referme en la validant. Même partage que pendant la séance.
   */
  const soleMeasure =
    editingExercise?.measurementIds.length === 1 && !editingExercise.isUnilateral;

  /** Ajouter une série, c'est répéter la précédente : on corrige ensuite. */
  function addSet(key: string) {
    setDraft((current) =>
      current.map((entry) => {
        if (entry.key !== key) return entry;
        const exercise = exerciseOf(entry.exerciseId);
        const last = entry.sets[entry.sets.length - 1];
        const next = last ?? (exercise ? firstSet(exercise) : null);
        return next ? { ...entry, sets: [...entry.sets, copyValues(next)] } : entry;
      }),
    );
  }

  /**
   * Retirer la dernière série retire l'exercice : un exercice sans série ne
   * dit rien d'une séance, et c'est pour cela qu'il en reçoit une à l'ajout.
   */
  function removeSet(key: string, setIndex: number) {
    setEditingSet(null);
    setDraft((current) => {
      const entry = current.find((candidate) => candidate.key === key);
      if (!entry || entry.sets.length <= 1) {
        return current.filter((candidate) => candidate.key !== key);
      }
      return current.map((candidate) =>
        candidate.key === key
          ? { ...candidate, sets: candidate.sets.filter((_, index) => index !== setIndex) }
          : candidate,
      );
    });
  }

  /** Une valeur se change directement sur sa série, sans étape de validation. */
  function adjust(key: string, setIndex: number, side: Side, measurementId: string, value: number) {
    setDraft((current) =>
      current.map((entry) =>
        entry.key === key
          ? {
              ...entry,
              sets: entry.sets.map((values, index) =>
                index === setIndex
                  ? { ...values, [side]: { ...(values[side] ?? {}), [measurementId]: value } }
                  : values,
              ),
            }
          : entry,
      ),
    );
  }

  /**
   * Partir d'un entraînement : ses exercices et ses séries deviennent le
   * brouillon, et ses cibles deviennent des valeurs faites.
   *
   * C'est ce qui rend l'écran utilisable pour une vraie séance : « j'ai fait
   * mon Push » se corrige en trois taps, là où tout ressaisir en demande
   * trente. Le plan n'est qu'un point de départ -- dévier reste la règle
   * (n°14), et rien ici n'oblige à lui ressembler.
   */
  function startFrom(plan: PlannedWorkout | null) {
    setSheet('none');
    setFrom(plan);
    if (!plan) return;

    const kept = plan.exercises.flatMap((planned) => {
      const exercise = exerciseOf(planned.exerciseId);
      if (!exercise) return [];
      const sets = planned.sets.map((set) => overSides(exercise, { ...set.targets }));
      return [keyed(exercise.id, sets.length > 0 ? sets : [firstSet(exercise)])];
    });

    setDraft(kept);

    // Un entraînement peut porter un exercice retiré du catalogue depuis :
    // il ne se propose plus à la saisie, et le taire laisserait croire que
    // le plan n'en avait que trois.
    const dropped = plan.exercises.length - kept.length;
    if (dropped > 0) {
      notify(
        `${dropped} exercice${dropped > 1 ? 's' : ''} de cet entraînement ${
          dropped > 1 ? 'ont été retirés' : 'a été retiré'
        } du catalogue : ${dropped > 1 ? 'ils ne sont' : "il n'est"} pas repris.`,
      );
    }
  }

  async function submit() {
    setSaving(true);
    try {
      const session = await logPastSession({
        at,
        durationSeconds,
        plannedWorkoutId: from?.id ?? null,
        exercises: draft.map((entry) => ({ exerciseId: entry.exerciseId, sets: entry.sets })),
      });
      // La séance enregistrée s'ouvre sur son bilan, comme celle qu'on vient
      // de terminer : c'est le même objet, arrivé par un autre chemin.
      router.replace({ pathname: '/session-summary', params: { id: session.id } });
    } catch (e) {
      notify(messageOf(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      className="flex-1 bg-background pb-3 dark:bg-background-dark"
    >
      <View className="px-5 pt-4">
        <BackHeader
          title="Enregistrer une séance"
          subtitle="ce que tu as fait, après coup"
          onBack={() => router.back()}
        />
      </View>

      <View className="flex-1">
        <ScrollView contentContainerClassName="gap-3 px-5 pb-28" keyboardShouldPersistTaps="handled">
          {/* Les trois choses qu'on sait en rentrant : quand, combien de
              temps, et d'où on est parti. */}
          <Row label="Date et heure" value={formatDateTime(at)} onPress={() => setSheet('when')} />
          <Row
            label="Durée"
            value={formatSessionDuration(durationSeconds)}
            onPress={() => setSheet('duration')}
          />
          <Row
            label="Entraînement suivi"
            value={from ? from.name : 'Séance libre'}
            onPress={() => setSheet('plans')}
          />

          {draft.length === 0 && (
            <Card density="titled" className="mt-2 gap-1">
              <Text className="font-bold text-body text-ink dark:text-ink-dark">
                Qu'as-tu fait ?
              </Text>
              <Text className="text-small text-muted dark:text-muted-dark">
                Ajoute tes exercices un par un, ou pars d'un entraînement existant pour n'avoir
                qu'à corriger.
              </Text>
            </Card>
          )}

          {draft.map((entry) => {
            const exercise = exerciseOf(entry.exerciseId);
            return (
              <Collapsible
                key={entry.key}
                title={
                  <Text
                    className="shrink font-bold text-body text-ink dark:text-ink-dark"
                    numberOfLines={1}
                  >
                    {exercise?.name ?? entry.exerciseId}
                  </Text>
                }
                summary={`${entry.sets.length} série${entry.sets.length > 1 ? 's' : ''}`}
                defaultOpen
              >
                {entry.sets.map((values, setIndex) => (
                  <SetLine
                    key={setIndex}
                    position={setIndex + 1}
                    value={formatSetValues(values, unitOf)}
                    onPress={() => setEditingSet({ key: entry.key, setIndex })}
                    onRemove={() => removeSet(entry.key, setIndex)}
                  />
                ))}

                <Button
                  label="+ Ajouter une série"
                  variant="secondary"
                  size="sm"
                  className="mt-2"
                  onPress={() => addSet(entry.key)}
                />
              </Collapsible>
            );
          })}
        </ScrollView>

        <Fab accessibilityLabel="Ajouter des exercices" onPress={() => setPicking(true)} />
      </View>

      <View className="p-5 pt-2">
        <Button
          label={saving ? 'Enregistrement…' : 'Enregistrer la séance'}
          size="lg"
          disabled={draft.length === 0 || saving}
          onPress={submit}
        />
      </View>

      <DatePickerSheet
        visible={sheet === 'when'}
        title="Quand cette séance a eu lieu"
        confirmLabel="Choisir"
        initial={at}
        onConfirm={(chosen) => {
          setSheet('none');
          setAt(chosen);
        }}
        onClose={() => setSheet('none')}
      />

      <Sheet
        visible={sheet === 'duration'}
        title="Combien de temps"
        description="Ce que tu déclares avoir passé à la salle, du premier au dernier exercice."
        onClose={() => setSheet('none')}
      >
        <SessionDurationWheels value={durationSeconds} onChange={setDurationSeconds} />
      </Sheet>

      {/* Partir d'un entraînement REMPLACE ce qui est saisi : la feuille le
          dit, plutôt que de le faire découvrir. */}
      <Sheet
        visible={sheet === 'plans'}
        title="Partir d'un entraînement"
        description="Ses exercices et ses séries remplacent ta saisie, avec ses cibles pour valeurs de départ. Tu corriges ensuite ce qui a vraiment été fait."
        // Au-delà d'une poignée d'entraînements, on cherche le sien plutôt
        // que de le repérer dans une liste qui défile.
        searchPlaceholder={plans.length > 6 ? 'Chercher un entraînement' : undefined}
        actions={[
          ...plans.map((plan) => ({ label: plan.name, onPress: () => startFrom(plan) })),
          { label: 'Aucun · séance libre', onPress: () => startFrom(null) },
        ]}
        onClose={() => setSheet('none')}
      />

      <ExercisePicker
        catalogue={catalogue}
        onCreate={(name, currentlySelected) => {
          pendingSelection.current = [...currentlySelected];
          router.push({ pathname: '/new-exercise', params: { name, announce: '1' } });
        }}
        onOpenSettings={() => {
          setPicking(false);
          router.push('/settings');
        }}
        visible={picking}
        selectedIds={preselected}
        title="Ajouter des exercices"
        exercises={available}
        muscles={muscles}
        recentIds={recentIds}
        onConfirm={(ids) => {
          setPreselected([]);
          setDraft((current) => [
            ...current,
            ...ids.flatMap((exerciseId) => {
              const exercise = exerciseOf(exerciseId);
              return exercise ? [keyed(exerciseId, [firstSet(exercise)])] : [];
            }),
          ]);
        }}
        onClose={() => {
          setPreselected([]);
          setPicking(false);
        }}
      />

      {/* Une seule feuille pour toutes les séries, comme sur une séance
          passée : celle qu'on règle dit ce qu'elle montre. */}
      <Sheet
        visible={editingSet !== null && editedValues !== undefined}
        title={editingSet ? `Série ${editingSet.setIndex + 1}` : ''}
        description={editingExercise?.name}
        actions={
          editingSet
            ? [
                {
                  label: 'Retirer cette série',
                  tone: 'danger' as const,
                  onPress: () => removeSet(editingSet.key, editingSet.setIndex),
                },
              ]
            : []
        }
        onClose={() => setEditingSet(null)}
      >
        {editingSet && editingExercise && editedValues && (
          <View className="gap-4 pb-2">
            {sidesOf(editingExercise).map((side) => (
              <View key={side} className="gap-1">
                {side !== 'BOTH' && (
                  <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
                    {side === 'LEFT' ? 'Côté gauche' : 'Côté droit'}
                  </Text>
                )}
                <View className="flex-row gap-3">
                  {editingExercise.measurementIds.map((measurementId) => (
                    <MeasureField
                      key={measurementId}
                      compact
                      unit={unitOf(measurementId)}
                      measurementId={measurementId}
                      value={editedValues[side]?.[measurementId] ?? 0}
                      onChange={(value) =>
                        adjust(editingSet.key, editingSet.setIndex, side, measurementId, value)
                      }
                      onDone={soleMeasure ? () => setEditingSet(null) : undefined}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </Sheet>
    </SafeAreaView>
  );
}

/** Un réglage de la séance : ce qu'il vaut à droite, et il s'ouvre au tap. */
function Row({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <Card density="titled" className="flex-row items-center justify-between gap-3">
        <View className="shrink">
          <Text className="font-bold text-body text-ink dark:text-ink-dark">{label}</Text>
          <Text className="font-mono text-caption text-muted dark:text-muted-dark">{value}</Text>
        </View>
        <Text className="text-caption text-primary-ink dark:text-primary-ink-dark">Modifier</Text>
      </Card>
    </Pressable>
  );
}

/**
 * Une copie indépendante des valeurs d'une série.
 *
 * Écrite à la main plutôt que déléguée à `structuredClone` : deux niveaux
 * suffisent -- les côtés, puis leurs mesures -- et rien ne garantit la
 * présence de la fonction dans le moteur qui fait tourner l'application.
 * Sans copie, régler la série ajoutée changerait aussi celle dont elle vient.
 */
function copyValues(values: ValuesBySide): ValuesBySide {
  return Object.fromEntries(
    Object.entries(values).map(([side, sideValues]) => [side, { ...sideValues }]),
  );
}

/** Une série du brouillon : son rang, ses valeurs, et son retrait d'un geste. */
function SetLine({
  position,
  value,
  onPress,
  onRemove,
}: {
  position: number;
  value: string;
  onPress: () => void;
  onRemove: () => void;
}) {
  const danger = useColorScheme() === 'dark' ? '#FF7A66' : '#B3261E';

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-baseline justify-between gap-3 border-b border-border py-2.5 dark:border-border-dark"
    >
      <View className="flex-row items-baseline gap-2">
        <Pressable onPress={onRemove} hitSlop={12}>
          <Ionicons name="remove-circle-outline" size={17} color={danger} />
        </Pressable>
        <Text className="text-small text-muted dark:text-muted-dark">Série {position}</Text>
      </View>
      <Text
        className="font-mono-bold text-lead text-ink dark:text-ink-dark"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>
    </Pressable>
  );
}

/** Les crans d'une séance : jusqu'à cinq heures, par quarts de cinq minutes. */
const HOURS = ladder(1, 5);
const MINUTES = ladder(5, 55);

/**
 * La durée d'une SÉANCE, en heures et minutes.
 *
 * Pas le champ des autres durées, qui se règle en minutes et secondes : une
 * série tient en trente secondes, une séance en une heure et quart, et la
 * même roulette ne peut pas servir les deux sans que l'une devienne
 * interminable à faire défiler.
 */
function SessionDurationWheels({
  value,
  onChange,
}: {
  value: number;
  onChange: (seconds: number) => void;
}) {
  const hours = Math.floor(value / 3600);
  const minutes = Math.round((value % 3600) / 60);

  return (
    <View className="items-center gap-2 pb-2">
      <Text className="font-mono-bold text-heading text-ink dark:text-ink-dark">
        {formatSessionDuration(value)}
      </Text>
      <View className="flex-row items-center justify-center gap-2">
        <Wheel
          values={HOURS}
          unit="h"
          value={hours}
          onChange={(h) => onChange(h * 3600 + minutes * 60)}
        />
        <Wheel
          values={MINUTES}
          unit="min"
          value={minutes}
          onChange={(m) => onChange(hours * 3600 + m * 60)}
        />
      </View>
    </View>
  );
}

/** « 1 h 15 », « 45 min » : une durée de séance telle qu'on la dit. */
function formatSessionDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, '0')}`;
}
