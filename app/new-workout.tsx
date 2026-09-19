import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../src/ui/notifications';
import { messageOf } from '../src/ui/message';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Exercise } from '../src/domain/exercise/exercise';
import type { Measurement } from '../src/domain/exercise/measurement';
import type { Muscle } from '../src/domain/exercise/muscle';
import type { PlannedExercise } from '../src/domain/planned-workout/planned-workout';
import { findAllMeasurements, findAllMuscles } from '../src/infra/exercise-repository';
import { findRecentExerciseIds } from '../src/infra/performance-repository';
import { discardWorkout, listActiveExercises } from '../src/use-cases/edit-catalogue';
import { Button } from '../src/ui/button';
import { Collapsible } from '../src/ui/collapsible';
import {
  NestedReorderableList,
  ScrollViewContainer,
  reorderItems,
  useIsActive,
  useReorderableDrag,
} from 'react-native-reorderable-list';
import { MeasureField } from '../src/ui/measure-field';
import { ExercisePicker } from '../src/ui/exercise-picker';
import { catalogueSource } from '../src/use-cases/repdb-actions';
import { takeCreated } from '../src/ui/created-exercise';
import { BackHeader } from '../src/ui/screen-header';
import { Fab } from '../src/ui/fab';
import { Sheet } from '../src/ui/sheet';
import {
  createPlannedWorkout,
  updatePlannedWorkout,
} from '../src/use-cases/create-planned-workout';
import { findAll as findAllPlans } from '../src/infra/planned-workout-repository';
import type { PlannedWorkout } from '../src/domain/planned-workout/planned-workout';

import { defaultTargets } from '../src/ui/set-defaults';
import { formatTargets } from '../src/ui/set-values';
import { EMOM_INTERVAL_SECONDS } from '../src/domain/workout-session/emom';


/** Un exercice du brouillon, et de quoi le suivre à travers les déplacements. */
type Planned = { key: string; planned: PlannedExercise };

/**
 * Un exercice arrive toujours avec UNE série : un exercice sans série ne veut
 * rien dire dans un entraînement.
 */
function defaultSet(exercise: Exercise): { targets: Record<string, number> } {
  return { targets: defaultTargets(exercise.measurementIds) };
}

/**
 * Création ET édition : un identifiant dans la route fait passer l'écran en
 * mode édition. Le brouillon vit dans l'écran, rien n'est écrit avant
 * validation -- y compris quand on modifie un entraînement existant.
 */
export default function NewWorkoutScreen() {
  const { notify } = useNotifications();
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
  /** L'exercice qu'on vient de créer, coché d'avance à la réouverture. */
  const [preselected, setPreselected] = useState<string[]>([]);
  /** Ce qui était déjà coché quand on est parti créer une variante. */
  const pendingSelection = useRef<string[]>([]);
  /** Le menu de l'écran, et la confirmation qu'il peut demander. */
  const [sheet, setSheet] = useState<'none' | 'menu' | 'confirm-discard'>('none');
  /**
   * En édition, une série se lit d'abord -- comme dans la fiche d'une séance
   * passée -- et ne s'ouvre qu'au tap. À la création, on saisit en rafale
   * plusieurs séries à la suite : les champs restent tous visibles.
   */
  const [editingSet, setEditingSet] = useState<{ key: string; setIndex: number } | null>(null);

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
        .catch((e) => notify(messageOf(e)));

      /**
       * Revenir du formulaire d'exercice reprend le geste interrompu : le
       * sélecteur se rouvre avec ce qu'on vient de créer, ET ce qui était
       * déjà coché avant le détour -- sans quoi choisir un exercice puis en
       * créer un second désélectionnait le premier.
       */
      const created = takeCreated();
      if (created) {
        setPreselected([...pendingSelection.current, created]);
        pendingSelection.current = [];
        setPicking(true);
      }
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
      .catch((e) => notify(messageOf(e)));
  }, [id, keyed]);

  const catalogue = useMemo(
    () =>
      catalogueSource(() => {
        listActiveExercises().then(setAvailable).catch((e) => notify(messageOf(e)));
      }),
    [],
  );

  const exerciseOf = (id: string) => available.find((e) => e.id === id);
  const unitOf = (id: string) => measurements.find((m) => m.id === id)?.unit ?? id;

  const editingEntry = editingSet ? draft.find((entry) => entry.key === editingSet.key) : undefined;
  const editingExercise = editingEntry ? exerciseOf(editingEntry.planned.exerciseId) : undefined;
  const editingTargets = editingEntry?.planned.sets[editingSet?.setIndex ?? -1]?.targets;
  /**
   * L'exercice ne se mesure-t-il que d'une façon ?
   *
   * Alors la roulette EST tout le réglage de la série : une fois la valeur
   * choisie, il ne reste rien à faire dans la feuille, et la refermer à la
   * main demanderait un geste qui ne dit rien de plus. Dès qu'une seconde
   * mesure existe, la roulette n'en règle qu'une part et la feuille reste --
   * même partage que pendant la séance.
   */
  const soleMeasure = editingExercise?.measurementIds.length === 1;

  /**
   * Ajouter une série, c'est répéter la précédente.
   *
   * Quatre séries identiques sont le cas courant ; on les corrige ensuite là
   * où elles diffèrent, au lieu de saisir quatre fois la même chose.
   */
  function addSet(key: string) {
    const entry = draft.find((candidate) => candidate.key === key);
    const exercise = entry && exerciseOf(entry.planned.exerciseId);
    if (!exercise) return;

    setDraft((current) =>
      current.map((entry) => {
        if (entry.key !== key) return entry;
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
  }

  /** Une cible se change directement sur sa série, sans étape de validation. */
  function changeTarget(key: string, setIndex: number, measurementId: string, value: number) {
    setDraft((current) =>
      current.map((entry) =>
        entry.key === key
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

  /**
   * Basculer un exercice entre séries libres et EMOM.
   *
   * Le rythme, et RIEN d'autre : les séries ne bougent pas, elles deviennent
   * des rounds. Quatre séries de cinq tractions font quatre rounds de cinq
   * tractions -- ce qui change est la façon dont ils s'enchaînent, pas ce
   * qu'ils contiennent.
   */
  function toggleEmom(key: string) {
    setDraft((current) =>
      current.map((entry) =>
        entry.key === key
          ? {
              ...entry,
              planned: {
                ...entry.planned,
                intervalSeconds: entry.planned.intervalSeconds ? null : EMOM_INTERVAL_SECONDS,
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

  /**
   * Retirer la dernière série retire l'exercice.
   *
   * Un exercice sans série ne veut rien dire dans un entraînement -- c'est
   * pour cela qu'il en reçoit une à l'ajout. Le laisser vide obligeait à un
   * second bouton pour dire la même chose.
   */
  function removeSet(key: string, setIndex: number) {
    setDraft((current) => {
      const entry = current.find((candidate) => candidate.key === key);
      if (!entry || entry.planned.sets.length <= 1) {
        return current.filter((candidate) => candidate.key !== key);
      }

      return current.map((entry) =>
        entry.key === key
          ? {
              ...entry,
              planned: {
                ...entry.planned,
                sets: entry.planned.sets.filter((_, i) => i !== setIndex),
              },
            }
          : entry,
      );
    });
  }

  /** Archivé s'il a déjà produit des séances, supprimé sinon : la base tranche. */
  async function discard() {
    if (!existing) return;
    try {
      await discardWorkout(existing);
      router.back();
    } catch (e) {
      notify(messageOf(e));
    }
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
      notify(messageOf(e));
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
          // Rien à retirer tant que l'entraînement n'existe pas : pas de menu.
          onMenu={existing ? () => setSheet('menu') : undefined}
        />
      </View>

      {/* La pastille est posée DANS la zone qui défile, et non sur l'écran :
          son `bottom-6` se compte alors depuis le haut de la barre du bas,
          exactement comme il se compte depuis le haut de la barre d'onglets
          sur les catalogues. Aucune hauteur à deviner, et rien à rattraper
          sur les téléphones à barre gestuelle.

          La liste, elle, défile DESSOUS : son rembourrage bas lui laisse de
          quoi finir sans être recouverte. */}
      <View className="flex-1">
        <ScrollViewContainer
          contentContainerClassName="gap-4 px-5 pb-28"
          keyboardShouldPersistTaps="handled"
        >
          <TextInput
            className="h-14 rounded-lg border-[1.5px] border-border bg-surface px-4 text-strong text-ink dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
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
            renderItem={({ item }) => (
              <DraftCard
                entry={item}
                exercise={exerciseOf(item.planned.exerciseId)}
                unitOf={unitOf}
                onOpenSet={(setIndex) => setEditingSet({ key: item.key, setIndex })}
                onAddSet={() => addSet(item.key)}
                onRemoveSet={(setIndex) => removeSet(item.key, setIndex)}
                onToggleEmom={() => toggleEmom(item.key)}
              />
            )}
          />

        </ScrollViewContainer>

        <Fab accessibilityLabel="Ajouter des exercices" onPress={() => setPicking(true)} />
      </View>

      {/* Un même exercice peut revenir dans un entraînement -- un finisher en
          fin de séance --, donc rien n'est coché d'avance et chaque passage
          ajoute ce qu'on vient de choisir. */}
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
          // Elle a fait son office : la garder cocherait le même exercice à
          // chaque ouverture suivante.
          setPreselected([]);
          setDraft((current) => [
            ...current,
            ...ids.map((exerciseId) => {
              const exercise = available.find((candidate) => candidate.id === exerciseId);
              return keyed({ exerciseId, sets: exercise ? [defaultSet(exercise)] : [] });
            }),
          ]);
        }}
        onClose={() => {
          setPreselected([]);
          setPicking(false);
        }}
      />

      {/* Une seule feuille pour toutes les séries en édition, comme pour une
          séance passée : celle qu'on règle dit ce qu'elle montre. */}
      <Sheet
        visible={editingSet !== null && editingEntry !== undefined}
        title={
          editingSet
            ? `${editingEntry?.planned.intervalSeconds ? 'Round' : 'Série'} ${editingSet.setIndex + 1}`
            : ''
        }
        description={editingExercise?.name}
        // Plus de retrait ici : le « − » rouge de chaque ligne le fait d'un
        // seul geste, sans ouvrir la feuille de celle qu'on veut justement
        // faire disparaître.
        onClose={() => setEditingSet(null)}
      >
        {editingSet && editingExercise && editingTargets && (
          <View className="flex-row flex-wrap gap-3 pb-2">
            {editingExercise.measurementIds.map((measurementId) => (
              <MeasureField
                key={measurementId}
                compact
                unit={unitOf(measurementId)}
                measurementId={measurementId}
                value={editingTargets[measurementId] ?? 0}
                onChange={(value) =>
                  changeTarget(editingSet.key, editingSet.setIndex, measurementId, value)
                }
                onDone={soleMeasure ? () => setEditingSet(null) : undefined}
              />
            ))}
          </View>
        )}
      </Sheet>

      <Sheet
        visible={sheet === 'menu'}
        title={existing?.name ?? 'Entraînement'}
        actions={[
          {
            label: 'Retirer du catalogue',
            tone: 'danger' as const,
            onPress: () => setSheet('confirm-discard'),
          },
        ]}
        onClose={() => setSheet('none')}
      />

      {/* Retirer n'est pas toujours la même opération : la base tranche entre
          archiver et supprimer. La confirmation annonce les deux, faute de
          pouvoir dire laquelle avant d'avoir regardé. */}
      <Sheet
        visible={sheet === 'confirm-discard'}
        title="Retirer cet entraînement ?"
        description="S'il a déjà produit des séances, il est archivé et reste attaché à ton historique. Sinon, il est supprimé."
        actions={[{ label: 'Retirer', tone: 'danger', onPress: discard }]}
        onClose={() => setSheet('none')}
      />

      <View className="p-5 pt-2">
        <Button
          label={existing ? 'Enregistrer les modifications' : "Créer l'entraînement"}
          size="lg"
          // Le domaine accepte un entraînement vide -- il n'a pas à juger d'une
          // intention -- mais l'écran, lui, sait qu'on n'a pas fini : un
          // entraînement sans nom ni exercice n'est pas quelque chose qu'on
          // voulait créer.
          disabled={name.trim() === '' || draft.length === 0}
          onPress={submit}
        />
      </View>
    </SafeAreaView>
  );
}

/**
 * Une carte du brouillon.
 *
 * Une série SE LIT, et ne se règle qu'en la touchant -- le même partage que
 * pour une séance passée ou une condition d'objectif. Composant à part parce
 * que la poignée réclame un crochet : c'est lui qui relie le geste à la
 * liste, et un crochet ne s'appelle pas au milieu d'une fonction de rendu.
 */
function DraftCard({
  entry,
  exercise,
  unitOf,
  onOpenSet,
  onAddSet,
  onRemoveSet,
  onToggleEmom,
}: {
  entry: Planned;
  exercise: Exercise | undefined;
  unitOf: (measurementId: string) => string;
  onOpenSet: (setIndex: number) => void;
  onAddSet: () => void;
  onRemoveSet: (setIndex: number) => void;
  onToggleEmom: () => void;
}) {
  const drag = useReorderableDrag();
  const dragging = useIsActive();
  // Les icônes reçoivent leur couleur en propriété : la variante dark: ne
  // s'applique qu'aux composants stylés par la feuille.
  const danger = useColorScheme() === 'dark' ? '#FF7A66' : '#B3261E';
  const planned = entry.planned;
  /**
   * Un round EST une série : même ligne, même réglage, même retrait. Seul le
   * mot change, parce que ce qui change est la façon dont ils s'enchaînent --
   * l'horloge plutôt que le souffle.
   */
  const emom = Boolean(planned.intervalSeconds);
  const unit = emom ? 'round' : 'série';

  return (
    <Collapsible
      title={
        <View className="flex-row items-center gap-2">
          <Pressable onPressIn={drag} className="h-9 w-8 items-center justify-center rounded-md">
            <Ionicons name="reorder-two" size={20} color={dragging ? '#BFF04A' : '#8B9086'} />
          </Pressable>
          <Text
            className="shrink font-bold text-body text-ink dark:text-ink-dark"
            numberOfLines={1}
          >
            {exercise?.name ?? planned.exerciseId}
          </Text>
        </View>
      }
      summary={`${planned.sets.length} ${unit}${planned.sets.length > 1 ? 's' : ''}`}
      defaultOpen
    >
      {planned.sets.map((set, index) => (
        <Pressable
          key={index}
          onPress={() => onOpenSet(index)}
          className="flex-row items-baseline justify-between gap-3 border-b border-border py-2.5 dark:border-border-dark"
        >
          <View className="flex-row items-baseline gap-2">
            {/* Le raccourci du geste le plus courant : on se trompe d'une
                série plus souvent qu'on ne veut ouvrir sa feuille pour la
                retirer. Celle-ci garde le même retrait, pour la main qui
                était déjà en train de régler la cible. */}
            <Pressable onPress={() => onRemoveSet(index)} hitSlop={12}>
              <Ionicons name="remove-circle-outline" size={17} color={danger} />
            </Pressable>
            <Text className="text-small text-muted dark:text-muted-dark">
              {emom ? 'Round' : 'Série'} {index + 1}
            </Text>
          </View>
          <Text
            className="font-mono-bold text-lead text-ink dark:text-ink-dark"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {formatTargets(set.targets, unitOf)}
          </Text>
        </Pressable>
      ))}

      <Button
        label={`+ Ajouter un${emom ? ' round' : 'e série'}`}
        variant="secondary"
        size="sm"
        className="mt-2"
        onPress={onAddSet}
      />

      {/* Le rythme se décide ici, une fois -- la séance, elle, n'aura plus à
          le demander. Un interrupteur et non un bouton : il ne fait rien
          arriver, il dit dans quel état est l'exercice. */}
      <View className="mt-1 flex-row items-center justify-end gap-2">
        <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
          EMOM
        </Text>
        <Switch
          value={emom}
          onValueChange={onToggleEmom}
          trackColor={{ true: '#BFF04A', false: '#C3C8B8' }}
          thumbColor="#FFFFFF"
        />
      </View>
    </Collapsible>
  );
}
