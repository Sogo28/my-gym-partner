import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { messageOf } from '../src/ui/message';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Exercise } from '../src/domain/exercise/exercise';
import type { Measurement } from '../src/domain/exercise/measurement';
import type { Muscle } from '../src/domain/exercise/muscle';
import type { PlannedExercise } from '../src/domain/planned-workout/planned-workout';
import { findAllMeasurements, findAllMuscles } from '../src/infra/exercise-repository';
import { findRecentExerciseIds } from '../src/infra/performance-repository';
import { listActiveExercises } from '../src/use-cases/edit-catalogue';
import { Button } from '../src/ui/button';
import { Collapsible } from '../src/ui/collapsible';
import {
  NestedReorderableList,
  ScrollViewContainer,
  reorderItems,
  useIsActive,
  useReorderableDrag,
} from 'react-native-reorderable-list';
import { NumberField } from '../src/ui/number-field';
import { BusinessNotice } from '../src/ui/notice';
import { ExercisePicker } from '../src/ui/exercise-picker';
import { catalogueSource } from '../src/use-cases/repdb-actions';
import { BackHeader } from '../src/ui/screen-header';
import {
  createPlannedWorkout,
  updatePlannedWorkout,
} from '../src/use-cases/create-planned-workout';
import { findAll as findAllPlans } from '../src/infra/planned-workout-repository';
import type { PlannedWorkout } from '../src/domain/planned-workout/planned-workout';

const STEPS: Record<string, number> = { reps: 1, weight: 2.5, duration: 1, distance: 10 };

/** Un exercice du brouillon, et de quoi le suivre à travers les déplacements. */
type Planned = { key: string; planned: PlannedExercise };

/**
 * Ce que vise une série qu'on vient de créer.
 *
 * Un exercice arrive toujours avec UNE série : un exercice sans série ne veut
 * rien dire dans un entraînement, et partir d'une valeur plausible se corrige
 * plus vite que de partir de rien.
 */
const DEFAULTS: Record<string, number> = { reps: 8, weight: 0, duration: 20, distance: 100 };

function defaultSet(exercise: Exercise): { targets: Record<string, number> } {
  return {
    targets: Object.fromEntries(
      exercise.measurementIds.map((id) => [id, DEFAULTS[id] ?? 0]),
    ),
  };
}

/**
 * Création ET édition : un identifiant dans la route fait passer l'écran en
 * mode édition. Le brouillon vit dans l'écran, rien n'est écrit avant
 * validation -- y compris quand on modifie un entraînement existant.
 */
export default function NewWorkoutScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [existing, setExisting] = useState<PlannedWorkout | null>(null);
  const [available, setAvailable] = useState<Exercise[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [muscles, setMuscles] = useState<Muscle[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [name, setName] = useState('');
  /**
   * Le brouillon vit dans l'écran : rien n'est écrit avant validation.
   *
   * Chaque entrée porte une clé stable, qui ne vient NI de sa position -- elle
   * change quand on réordonne, et React reconstruirait alors toutes les cartes
   * en perdant leur repli -- NI de l'exercice, puisqu'un même exercice peut
   * revenir deux fois dans un entraînement.
   */
  const [draft, setDraft] = useState<Planned[]>([]);
  const nextKey = useRef(0);
  const keyed = useCallback(
    (planned: PlannedExercise): Planned => ({ key: String(nextKey.current++), planned }),
    [],
  );
  const [error, setError] = useState<string | null>(null);

  // Les exercices disponibles se rechargent à chaque affichage...
  useFocusEffect(
    useCallback(() => {
      Promise.all([
        listActiveExercises(),
        findAllMeasurements(),
        findAllMuscles(),
        findRecentExerciseIds(),
      ])
        .then(([exercises, allMeasurements, allMuscles, recent]) => {
          setAvailable(exercises);
          setMeasurements(allMeasurements);
          setMuscles(allMuscles);
          setRecentIds(recent);
        })
        .catch((e) => setError(messageOf(e)));
    }, []),
  );

  // ...mais le brouillon en cours d'édition une seule fois.
  useEffect(() => {
    if (!id) return;
    findAllPlans()
      .then((plans) => {
        const plan = plans.find((candidate) => candidate.id === id);
        if (!plan) return;
        setExisting(plan);
        setName(plan.name);
        setDraft(plan.exercises.map(keyed));
      })
      .catch((e) => setError(messageOf(e)));
  }, [id, keyed]);

  const catalogue = useMemo(
    () =>
      catalogueSource(() => {
        listActiveExercises().then(setAvailable).catch((e) => setError(messageOf(e)));
      }),
    [],
  );

  const exerciseOf = (id: string) => available.find((e) => e.id === id);
  const unitOf = (id: string) => measurements.find((m) => m.id === id)?.unit ?? id;

  /**
   * Ajouter une série, c'est répéter la précédente.
   *
   * Quatre séries identiques sont le cas courant ; on les corrige ensuite là
   * où elles diffèrent, au lieu de saisir quatre fois la même chose.
   */
  function addSet(position: number) {
    const exercise = exerciseOf(draft[position].planned.exerciseId);
    if (!exercise) return;

    setDraft((current) =>
      current.map((entry, index) => {
        if (index !== position) return entry;
        const sets = entry.planned.sets;
        const last = sets[sets.length - 1];
        return {
          ...entry,
          planned: {
            ...entry.planned,
            sets: [...sets, last ? { targets: { ...last.targets } } : defaultSet(exercise)],
          },
        };
      }),
    );
    setError(null);
  }

  /** Une cible se change directement sur sa série, sans étape de validation. */
  function changeTarget(
    position: number,
    setIndex: number,
    measurementId: string,
    value: number,
  ) {
    setDraft((current) =>
      current.map((entry, index) =>
        index === position
          ? {
              ...entry,
              planned: {
                ...entry.planned,
                sets: entry.planned.sets.map((set, i) =>
                  i === setIndex ? { targets: { ...set.targets, [measurementId]: value } } : set,
                ),
              },
            }
          : entry,
      ),
    );
  }

  /** Déplacer un exercice : le retirer de sa place, le remettre à l'autre. */
  function moveExercise(from: number, to: number) {
    setDraft((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function removeExercise(position: number) {
    setDraft((current) => current.filter((_, index) => index !== position));
  }

  function removeSet(position: number, setIndex: number) {
    setDraft((current) =>
      current.map((entry, index) =>
        index === position
          ? {
              ...entry,
              planned: {
                ...entry.planned,
                sets: entry.planned.sets.filter((_, i) => i !== setIndex),
              },
            }
          : entry,
      ),
    );
  }

  async function submit() {
    try {
      const exercises = draft.map((entry) => entry.planned);
      if (existing) {
        await updatePlannedWorkout({ workout: existing, name, exercises });
      } else {
        await createPlannedWorkout({ name, exercises });
      }
      router.back();
    } catch (e) {
      setError(messageOf(e));
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background pb-3 dark:bg-background-dark">
      <View className="px-5 pt-4">
        <BackHeader
          title={existing ? "Modifier l'entraînement" : 'Nouvel entraînement'}
          subtitle={
            existing ? 'les séances passées ne changent pas' : 'valeurs cibles · aucune date'
          }
          onBack={() => router.back()}
        />
      </View>

      <ScrollViewContainer contentContainerClassName="gap-4 px-5 pb-8">
        <TextInput
          className="h-14 rounded-lg border-[1.5px] border-border bg-surface px-4 text-[17px] text-ink dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
          placeholder="Nom de l'entraînement"
          placeholderTextColor="#A8AD9E"
          value={name}
          onChangeText={setName}
        />

        {/* L'ordre des exercices EST une décision d'entraînement : on ne met
            pas le gainage avant les tractions. La liste imbriquée gère le
            glissement ET le défilement, que la page porte pour elle. */}
        <NestedReorderableList
          data={draft}
          keyExtractor={(entry) => entry.key}
          scrollEnabled={false}
          onReorder={({ from, to }) => setDraft((current) => reorderItems(current, from, to))}
          contentContainerStyle={{ gap: 16 }}
          renderItem={({ item, index }) => (
            <DraftCard
              entry={item}
              exercise={exerciseOf(item.planned.exerciseId)}
              unitOf={unitOf}
              onRemoveExercise={() => removeExercise(index)}
              onRemoveSet={(setIndex) => removeSet(index, setIndex)}
              onChangeTarget={(setIndex, measurementId, value) =>
                changeTarget(index, setIndex, measurementId, value)
              }
              onAddSet={() => addSet(index)}
            />
          )}
        />

        {/* Un texte, pas un bouton : ajouter un exercice est un geste parmi
            d'autres sur cette page, pas ce qu'elle demande. */}
        <Pressable onPress={() => setPicking(true)} className="py-2">
          <Text className="text-center text-[15px] text-primary-ink dark:text-primary-ink-dark">
            + Ajouter des exercices
          </Text>
        </Pressable>

        {error && <BusinessNotice message={error} />}
      </ScrollViewContainer>

      {/* Un même exercice peut revenir dans un entraînement -- un finisher en
          fin de séance --, donc rien n'est coché d'avance et chaque passage
          ajoute ce qu'on vient de choisir. */}
      <ExercisePicker
        catalogue={catalogue}
        onCreate={(name) => router.push({ pathname: '/new-exercise', params: { name } })}
        onOpenSettings={() => {
          setPicking(false);
          router.push('/settings');
        }}
        visible={picking}
        title="Ajouter des exercices"
        exercises={available}
        muscles={muscles}
        recentIds={recentIds}
        onConfirm={(ids) =>
          setDraft((current) => [
            ...current,
            ...ids.map((exerciseId) => {
              const exercise = available.find((candidate) => candidate.id === exerciseId);
              return keyed({ exerciseId, sets: exercise ? [defaultSet(exercise)] : [] });
            }),
          ])
        }
        onClose={() => setPicking(false)}
      />

      <View className="p-5 pt-2">
        <Button
          label={existing ? 'Enregistrer les modifications' : 'Créer l entraînement'}
          size="lg"
          onPress={submit}
        />
      </View>
    </SafeAreaView>
  );
}

/**
 * Une carte du brouillon.
 *
 * Composant à part parce que la poignée réclame un crochet : c'est lui qui
 * relie le geste à la liste, et un crochet ne s'appelle pas au milieu d'une
 * fonction de rendu.
 */
function DraftCard({
  entry,
  exercise,
  unitOf,
  onRemoveExercise,
  onRemoveSet,
  onChangeTarget,
  onAddSet,
}: {
  entry: Planned;
  exercise: Exercise | undefined;
  unitOf: (measurementId: string) => string;
  onRemoveExercise: () => void;
  onRemoveSet: (setIndex: number) => void;
  onChangeTarget: (setIndex: number, measurementId: string, value: number) => void;
  onAddSet: () => void;
}) {
  const drag = useReorderableDrag();
  const dragging = useIsActive();
  const planned = entry.planned;

  return (
    <Collapsible
      title={
        <View className="flex-row items-center gap-2">
          {/* La poignée saisit dès le contact : posée sur la carte entière,
              le geste serait capté par le premier élément tapable dedans. */}
          <Pressable onPressIn={drag} className="h-9 w-8 items-center justify-center rounded-md">
            <Ionicons name="reorder-two" size={20} color={dragging ? '#BFF04A' : '#8B9086'} />
          </Pressable>
          <Text
            className="shrink font-bold text-[16px] text-ink dark:text-ink-dark"
            numberOfLines={1}
          >
            {exercise?.name ?? planned.exerciseId}
          </Text>
        </View>
      }
      summary={`${planned.sets.length} série${planned.sets.length > 1 ? 's' : ''}`}
      defaultOpen
    >
      <Pressable onPress={onRemoveExercise} hitSlop={8} className="pb-1">
        <Text className="text-[12px] text-danger dark:text-danger-dark">Retirer cet exercice</Text>
      </Pressable>

      {planned.sets.map((set, index) => (
        <View key={index} className="flex-row items-center gap-2 pt-1">
          {exercise?.measurementIds.map((measurementId) => (
            <NumberField
              key={measurementId}
              compact
              unit={unitOf(measurementId)}
              value={set.targets[measurementId] ?? 0}
              step={STEPS[measurementId] ?? 1}
              onChange={(value) => onChangeTarget(index, measurementId, value)}
            />
          ))}
          <Pressable
            onPress={() => onRemoveSet(index)}
            className="h-[40px] w-[40px] items-center justify-center rounded-lg border-2 border-border bg-surface dark:border-border-dark dark:bg-surface-dark"
          >
            <Ionicons name="remove" size={18} color="#B3261E" />
          </Pressable>
        </View>
      ))}

      <Button
        label="+ Ajouter une série"
        variant="secondary"
        size="sm"
        className="mt-2"
        onPress={onAddSet}
      />
    </Collapsible>
  );
}
