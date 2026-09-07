import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Exercise } from '../domain/exercise/exercise';
import type { Muscle } from '../domain/exercise/muscle';
import { Card } from './card';
import { Button } from './button';
import { cn } from './cn';
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
};

/** « Ischio-jambiers » se cherche en tapant « ischio ». */
const fold = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

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
}: ExercisePickerProps) {
  const [query, setQuery] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [filtering, setFiltering] = useState(false);

  // Chaque ouverture repart de la sélection que l'appelant nous donne, sans
  // traîner la recherche ni les filtres de la fois précédente.
  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setMuscleFilter([]);
    setSelected([...selectedIds]);
    setFiltering(false);
    // selectedIds est une liste : la comparer par référence rouvrirait le
    // sélecteur à chaque rendu du parent. Seule l'ouverture compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const nameOf = (id: string) => muscles.find((muscle) => muscle.id === id)?.name ?? id;

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
      muscleNames={exercise.muscleIds.map(nameOf)}
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
          <TextInput
            className="h-12 rounded-lg border border-border bg-surface px-4 text-[16px] text-ink dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
            placeholder="Chercher un exercice"
            placeholderTextColor="#A8AD9E"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />

          <Pressable
            onPress={() => setFiltering(true)}
            className={cn(
              'h-11 flex-row items-center gap-2 self-start rounded-full border px-4',
              muscleFilter.length > 0
                ? 'border-primary-ink bg-primary-soft dark:border-primary-ink-dark dark:bg-primary-soft-dark'
                : 'border-border bg-surface dark:border-border-dark dark:bg-surface-dark',
            )}
          >
            <Text
              className={cn(
                'font-medium text-[14px]',
                muscleFilter.length > 0
                  ? 'text-primary-ink dark:text-primary-ink-dark'
                  : 'text-muted dark:text-muted-dark',
              )}
            >
              {muscleFilter.length === 0
                ? 'Tous les muscles'
                : muscleFilter.length === 1
                  ? nameOf(muscleFilter[0])
                  : `${muscleFilter.length} muscles`}
            </Text>
          </Pressable>
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

          {matching.length === 0 && (
            <Text className="py-6 text-center text-[14px] text-muted dark:text-muted-dark">
              Aucun exercice ne correspond.
            </Text>
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

        <MuscleFilter
          visible={filtering}
          muscles={muscles}
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
  muscleNames,
  selected,
  showCheck,
  onPress,
}: {
  exercise: Exercise;
  muscleNames: string[];
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
          {muscleNames.length > 0 && (
            <View className="flex-row flex-wrap gap-1.5">
              {muscleNames.map((name) => (
                <Tag key={name} label={name} accent />
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

/**
 * Le filtre par muscle, en feuille par-dessus la liste.
 *
 * Le filtre s'applique à chaque touche plutôt qu'à la validation : le nombre
 * de résultats annoncé en bas est alors ce qu'on verra vraiment en fermant,
 * et non une promesse à vérifier.
 */
function MuscleFilter({
  visible,
  muscles,
  selected,
  results,
  onToggle,
  onClear,
  onClose,
}: {
  visible: boolean;
  muscles: readonly Muscle[];
  selected: string[];
  results: number;
  onToggle: (muscleId: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/50" onPress={onClose} />

      <View className="gap-3 rounded-t-3xl border-t border-border bg-background px-5 pb-8 pt-5 dark:border-border-dark dark:bg-background-dark">
        <Text className="text-center font-extrabold text-heading text-ink dark:text-ink-dark">
          Groupe musculaire
        </Text>

        <ScrollView className="max-h-96 grow-0" contentContainerClassName="flex-row flex-wrap gap-2">
          {muscles.map((muscle) => {
            const on = selected.includes(muscle.id);
            return (
              <Pressable
                key={muscle.id}
                onPress={() => onToggle(muscle.id)}
                // Deux par rangée : les noms sont longs, et une grille garde
                // l'oeil sur une colonne au lieu de le renvoyer à la ligne.
                className={cn(
                  'min-h-touch w-[48%] justify-center rounded-lg border px-4',
                  on
                    ? 'border-primary-ink bg-primary-soft dark:border-primary-ink-dark dark:bg-primary-soft-dark'
                    : 'border-border bg-surface dark:border-border-dark dark:bg-surface-dark',
                )}
              >
                <Text
                  className={cn(
                    'font-medium text-[15px]',
                    on
                      ? 'text-primary-ink dark:text-primary-ink-dark'
                      : 'text-ink dark:text-ink-dark',
                  )}
                  numberOfLines={1}
                >
                  {muscle.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View className="flex-row gap-3 pt-1">
          <Pressable
            onPress={onClear}
            className="min-h-action flex-1 items-center justify-center rounded-lg border border-border bg-surface dark:border-border-dark dark:bg-surface-dark"
          >
            <Text className="font-bold text-[15px] text-muted dark:text-muted-dark">
              Supprimer les filtres
            </Text>
          </Pressable>
          <Pressable
            onPress={onClose}
            className="min-h-action flex-1 items-center justify-center rounded-lg bg-primary"
          >
            <Text className="font-bold text-[15px] text-ink">
              {results} résultat{results > 1 ? 's' : ''}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
