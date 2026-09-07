import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Exercise } from '../domain/exercise/exercise';
import type { Muscle } from '../domain/exercise/muscle';
import { Card } from './card';
import { CatalogueRow } from './catalogue-row';
import { Button } from './button';
import { cn } from './cn';
import { MuscleFilterChip, MuscleFilterSheet } from './muscle-filter';
import { SearchField } from './search';
import { fold } from '../text';
import { BackHeader } from './screen-header';
import { Tag } from './tag';

/**
 * Le sélecteur d'exercices, partagé par tous les écrans qui en demandent un :
 * séance en cours, construction d'un entraînement, choix du sujet d'un
 * objectif.
 *
 * Il sélectionne PLUSIEURS exercices par défaut -- construire un entraînement
 * ou meubler une séance libre, c'est en choisir une poignée d'affilée, et
 * rouvrir la même liste à chaque fois est le genre de friction qu'on ne
 * remarque qu'en salle. `mode="single"` sert là où un seul a du sens.
 *
 * Pas de vignettes : nos exercices n'ont pas d'images, et une pastille vide
 * répétée sur trente lignes serait du bruit, pas un repère.
 */
/** Une entrée d'un catalogue tiers, proposée sous tes propres exercices. */
export type CatalogueSuggestion = {
  readonly id: string;
  readonly name: string;
  /** Ce qui la décrit en un mot : son matériel, ses muscles... */
  readonly detail: string;
};

export type ExercisePickerProps = {
  visible: boolean;
  /** Ce qu'on propose : à l'appelant d'écarter les exercices retirés. */
  exercises: readonly Exercise[];
  muscles: readonly Muscle[];
  /** Du plus récent au plus ancien, remontés en tête de liste. */
  recentIds?: readonly string[];
  /** Déjà retenus : ils s'affichent cochés. */
  selectedIds?: readonly string[];
  mode?: 'multiple' | 'single';
  title?: string;
  /** Le verbe de l'action, décliné sur le nombre : « Ajouter (3) ». */
  confirmLabel?: string;
  onConfirm: (exerciseIds: string[]) => void;
  onClose: () => void;
  /**
   * Ce qu'un catalogue tiers propose pour la recherche en cours, et ce qui
   * arrive quand on en choisit un. Absent : la section ne s'affiche pas.
   */
  catalogue?: {
    /** Faux tant qu'il n'est pas téléchargé : l'écran le dit au lieu de se taire. */
    readonly available: boolean;
    suggest: (query: string) => Promise<CataloguesuggestionList>;
    adopt: (id: string) => Promise<string>;
  };
  /** Ouvre les réglages, d'où le catalogue se télécharge. */
  onOpenSettings?: () => void;
  /**
   * Ouvrir le formulaire pour l'exercice cherché, quand ni le catalogue ni
   * toi ne l'avez. Le sélecteur se referme : on part le définir.
   */
  onCreate?: (name: string) => void;
};

type CataloguesuggestionList = readonly CatalogueSuggestion[];

export function ExercisePicker({
  visible,
  exercises,
  muscles,
  recentIds = [],
  selectedIds = [],
  mode = 'multiple',
  title = 'Ajouter un exercice',
  confirmLabel = 'Ajouter',
  onConfirm,
  onClose,
  catalogue,
  onOpenSettings,
  onCreate,
}: ExercisePickerProps) {
  const [query, setQuery] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [filtering, setFiltering] = useState(false);
  const [suggestions, setSuggestions] = useState<CataloguesuggestionList>([]);
  const [adopting, setAdopting] = useState<string | null>(null);

  // Chaque ouverture repart de la sélection que l'appelant nous donne, sans
  // traîner la recherche ni les filtres de la fois précédente.
  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setMuscleFilter([]);
    setSelected([...selectedIds]);
    setFiltering(false);
    setSuggestions([]);
    // selectedIds est une liste : la comparer par référence rouvrirait le
    // sélecteur à chaque rendu du parent. Seule l'ouverture compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const nameOf = (id: string) => muscles.find((muscle) => muscle.id === id)?.name ?? id;

  // Un muscle que personne ne travaille ne filtrerait que du vide.
  const usedMuscles = useMemo(
    () => muscles.filter((muscle) => exercises.some((e) => e.muscleIds.includes(muscle.id))),
    [muscles, exercises],
  );

  const matching = useMemo(() => {
    const needle = fold(query.trim());
    return exercises.filter((exercise) => {
      if (needle && !fold(exercise.name).includes(needle)) return false;
      // Plusieurs muscles retenus élargissent la recherche, ils ne la
      // restreignent pas : on cherche « du dos OU des biceps ».
      if (muscleFilter.length > 0 && !exercise.muscleIds.some((id) => muscleFilter.includes(id))) {
        return false;
      }
      return true;
    });
  }, [exercises, query, muscleFilter]);

  // Les récents ne s'affichent qu'en tête de liste vierge : dès qu'on cherche
  // ou qu'on filtre, ils ne sont plus une réponse à la question posée.
  const recent =
    query.trim() === '' && muscleFilter.length === 0
      ? recentIds
          .map((id) => exercises.find((exercise) => exercise.id === id))
          .filter((exercise): exercise is Exercise => exercise !== undefined)
      : [];

  /**
   * Le catalogue ne répond qu'à une recherche : dérouler six cents entrées
   * sous les siennes noierait les siennes.
   */
  useEffect(() => {
    if (!catalogue?.available || query.trim() === '') {
      setSuggestions([]);
      return;
    }
    let current = true;
    catalogue
      .suggest(query)
      .then((found) => {
        if (current) setSuggestions(found);
      })
      .catch(() => setSuggestions([]));
    return () => {
      current = false;
    };
  }, [catalogue, query]);

  /**
   * Aller définir ce qu'on cherchait : la callisthénie vit de variantes
   * qu'aucun catalogue ne connaît -- « Front lever tuck » n'existe que chez
   * toi, et se décrit avec ses mesures et ses muscles, pas d'un tap.
   */
  function create() {
    if (!onCreate) return;
    const wanted = query.trim();
    onClose();
    onCreate(wanted);
  }

  /** Adopter, c'est créer l'exercice puis le retenir comme les autres. */
  async function adopt(id: string) {
    if (!catalogue) return;
    setAdopting(id);
    try {
      const exerciseId = await catalogue.adopt(id);
      setSuggestions((current) => current.filter((entry) => entry.id !== id));
      if (mode === 'single') {
        onConfirm([exerciseId]);
        onClose();
        return;
      }
      setSelected((current) => [...current, exerciseId]);
    } finally {
      setAdopting(null);
    }
  }

  function toggle(exerciseId: string) {
    if (mode === 'single') {
      onConfirm([exerciseId]);
      onClose();
      return;
    }
    setSelected((current) =>
      current.includes(exerciseId)
        ? current.filter((id) => id !== exerciseId)
        : [...current, exerciseId],
    );
  }

  function confirm() {
    onConfirm(selected);
    onClose();
  }

  // Ce que l'en-tête annonce sous le titre : la taille de la liste qu'on
  // parcourt, ou le nombre d'exercices déjà retenus.
  const subtitle =
    mode === 'multiple' && selected.length > 0
      ? `${selected.length} sélectionné${selected.length > 1 ? 's' : ''}`
      : `${matching.length} exercice${matching.length > 1 ? 's' : ''}`;

  const row = (exercise: Exercise, key: string) => (
    <Row
      key={key}
      exercise={exercise}
      primaryMuscle={exercise.primaryMuscleId ? nameOf(exercise.primaryMuscleId) : null}
      secondaryMuscles={exercise.secondaryMuscleIds.map(nameOf)}
      selected={selected.includes(exercise.id)}
      showCheck={mode === 'multiple'}
      onPress={() => toggle(exercise.id)}
    />
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background dark:bg-background-dark">
        <View className="px-5 pt-4">
          <BackHeader title={title} subtitle={subtitle} onBack={onClose} />
        </View>

        <View className="gap-3 px-5 py-3">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Chercher un exercice"
          />

          <MuscleFilterChip
            muscles={usedMuscles}
            selected={muscleFilter}
            onPress={() => setFiltering(true)}
          />
        </View>

        <ScrollView className="flex-1" contentContainerClassName="px-5 pb-4">
          {recent.length > 0 && (
            <>
              <SectionLabel>Exercices récents</SectionLabel>
              {recent.map((exercise) => row(exercise, `recent-${exercise.id}`))}
              <SectionLabel>Tous les exercices</SectionLabel>
            </>
          )}

          {matching.map((exercise) => row(exercise, exercise.id))}

          {matching.length === 0 && suggestions.length === 0 && (
            <Text className="py-6 text-center text-[14px] text-muted dark:text-muted-dark">
              Aucun exercice ne correspond.
            </Text>
          )}

          {/* Ce que personne n'a : à ce stade, c'est le tien. */}
          {onCreate && query.trim() !== '' && matching.length === 0 && (
            <CatalogueRow
              name={`Créer « ${query.trim()} »`}
              detail="ouvre le formulaire, nom déjà rempli"
              onPress={create}
            />
          )}

          {/* Le catalogue vient APRÈS : ce que tu fais déjà passe devant ce
              qu'un tiers propose. */}
          {/* Chercher sans rien trouver, alors qu'un catalogue de 601
              exercices existe, ne doit pas ressembler à une app vide. */}
          {catalogue && !catalogue.available && query.trim() !== '' && (
            <Pressable onPress={onOpenSettings} className="py-4">
              <Text className="text-center text-[13px] text-muted dark:text-muted-dark">
                Le catalogue de 601 exercices n est pas téléchargé.
              </Text>
              <Text className="pt-1 text-center text-[13px] text-primary-ink dark:text-primary-ink-dark">
                L installer depuis les réglages
              </Text>
            </Pressable>
          )}

          {suggestions.length > 0 && (
            <>
              <SectionLabel>Dans le catalogue</SectionLabel>
              {suggestions.map((entry) => (
                <CatalogueRow
                  key={entry.id}
                  name={entry.name}
                  detail={entry.detail}
                  busy={adopting === entry.id}
                  onPress={() => adopt(entry.id)}
                />
              ))}
            </>
          )}
        </ScrollView>

        {/* Les actions restent en bas, sous le pouce : cette liste se parcourt
            d'une main, souvent debout entre deux séries. */}
        <View className="flex-row gap-3 p-5 pt-2">
          <Button label="Annuler" variant="secondary" size="lg" className="flex-1" onPress={onClose} />
          {mode === 'multiple' && (
            <Button
              label={selected.length > 0 ? `${confirmLabel} (${selected.length})` : confirmLabel}
              size="lg"
              className="flex-1"
              disabled={selected.length === 0}
              onPress={confirm}
            />
          )}
        </View>

        <MuscleFilterSheet
          visible={filtering}
          muscles={usedMuscles}
          selected={muscleFilter}
          results={matching.length}
          onToggle={(id) =>
            setMuscleFilter((current) =>
              current.includes(id) ? current.filter((m) => m !== id) : [...current, id],
            )
          }
          onClear={() => setMuscleFilter([])}
          onClose={() => setFiltering(false)}
        />
      </SafeAreaView>
    </Modal>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="pb-2 pt-4 font-bold uppercase text-label text-muted dark:text-muted-dark">
      {children}
    </Text>
  );
}

/**
 * Un exercice, en carte : son nom, et ses muscles en badges -- c'est ce qui
 * distingue deux variantes portant presque le même nom. Sans muscle
 * renseigné, la carte n'affiche rien de plus : une mention « aucun muscle »
 * prendrait une ligne pour ne rien apprendre.
 */
function Row({
  exercise,
  primaryMuscle,
  secondaryMuscles,
  selected,
  showCheck,
  onPress,
}: {
  exercise: Exercise;
  primaryMuscle: string | null;
  secondaryMuscles: string[];
  selected: boolean;
  showCheck: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="pb-2">
      <Card
        className={cn(
          'flex-row items-center gap-3',
          selected &&
            'border-primary-ink bg-primary-soft dark:border-primary-ink-dark dark:bg-primary-soft-dark',
        )}
      >
        <View className="flex-1 gap-1">
          <Text className="font-bold text-[16px] text-ink dark:text-ink-dark" numberOfLines={1}>
            {exercise.name}
          </Text>
          {(primaryMuscle !== null || secondaryMuscles.length > 0) && (
            <View className="flex-row flex-wrap gap-1.5">
              {primaryMuscle && <Tag label={primaryMuscle} variant="accent" />}
              {secondaryMuscles.map((name) => (
                <Tag key={name} label={name} variant="accent-outline" />
              ))}
            </View>
          )}
        </View>

        {showCheck && (
          <View
            className={cn(
              'h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
              selected
                ? 'border-primary-ink bg-primary-ink dark:border-primary-ink-dark dark:bg-primary-ink-dark'
                : 'border-border-strong dark:border-border-strong-dark',
            )}
          >
            {selected && <Ionicons name="checkmark" size={14} color="#0E0F0D" />}
          </View>
        )}
      </Card>
    </Pressable>
  );
}
