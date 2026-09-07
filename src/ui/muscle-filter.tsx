import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import type { Muscle } from '../domain/exercise/muscle';
import { cn } from './cn';

/**
 * Le filtre par muscle, partagé par le catalogue d'exercices et le sélecteur.
 *
 * La puce dit ce qui est retenu, la feuille laisse le changer. Plusieurs
 * muscles ÉLARGISSENT la recherche : on cherche « du dos ou des biceps », un
 * exercice qui devrait tous les cocher ne renverrait presque jamais rien.
 */
export function MuscleFilterChip({
  muscles,
  selected,
  onPress,
}: {
  muscles: readonly Muscle[];
  selected: readonly string[];
  onPress: () => void;
}) {
  const nameOf = (id: string) => muscles.find((muscle) => muscle.id === id)?.name ?? id;
  const active = selected.length > 0;

  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'h-11 flex-row items-center gap-2 self-start rounded-full border px-4',
        active
          ? 'border-primary-ink bg-primary-soft dark:border-primary-ink-dark dark:bg-primary-soft-dark'
          : 'border-border bg-surface dark:border-border-dark dark:bg-surface-dark',
      )}
    >
      <Text
        className={cn(
          'font-medium text-[14px]',
          active
            ? 'text-primary-ink dark:text-primary-ink-dark'
            : 'text-muted dark:text-muted-dark',
        )}
      >
        {selected.length === 0
          ? 'Tous les muscles'
          : selected.length === 1
            ? nameOf(selected[0])
            : `${selected.length} muscles`}
      </Text>
    </Pressable>
  );
}

/**
 * Le filtre s'applique à chaque touche plutôt qu'à la validation : le nombre
 * de résultats annoncé en bas est alors ce qu'on verra vraiment en fermant,
 * et non une promesse à vérifier.
 */
export function MuscleFilterSheet({
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
  selected: readonly string[];
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
