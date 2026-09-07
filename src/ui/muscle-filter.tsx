import type { Muscle } from '../domain/exercise/muscle';
import { OptionChip, OptionSheet } from './option-sheet';

/**
 * Le filtre par muscle du catalogue et du sélecteur d'exercices : la feuille
 * de choix générique, habillée du vocabulaire du FILTRE.
 *
 * Plusieurs muscles ÉLARGISSENT la recherche : on cherche « du dos ou des
 * biceps » ; un exercice qui devrait tous les cocher ne renverrait presque
 * jamais rien.
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
  return (
    <OptionChip
      options={muscles}
      selected={selected}
      emptyLabel="Tous les muscles"
      plural="muscles"
      onPress={onPress}
    />
  );
}

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
  /** Ce que le filtre laisse passer, annoncé sur le bouton de validation. */
  results: number;
  onToggle: (muscleId: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <OptionSheet
      visible={visible}
      title="Groupe musculaire"
      options={muscles}
      selected={selected}
      clearLabel="Supprimer les filtres"
      confirmLabel={`${results} résultat${results > 1 ? 's' : ''}`}
      onToggle={onToggle}
      onClear={onClear}
      onClose={onClose}
    />
  );
}
