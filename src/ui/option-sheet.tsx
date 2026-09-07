import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { cn } from './cn';

/** Ce qu'une feuille de choix manipule : de quoi afficher, et de quoi retenir. */
export type Option = { id: string; name: string };

/**
 * La puce qui ouvre une feuille de choix, et dit ce qui est retenu.
 *
 * Un choix multiple tient rarement sur une ligne : à trois options, les
 * étaler suffit ; à douze, la page ne parle plus que de ça. La puce garde la
 * place d'une ligne quel que soit le nombre d'options.
 */
export function OptionChip({
  options,
  selected,
  emptyLabel,
  plural,
  onPress,
}: {
  options: readonly Option[];
  selected: readonly string[];
  /** Ce qu'affiche la puce quand rien n'est retenu. */
  emptyLabel: string;
  /** Le nom de la catégorie au pluriel : « muscles », « mesures ». */
  plural: string;
  onPress: () => void;
}) {
  const nameOf = (id: string) => options.find((option) => option.id === id)?.name ?? id;
  const active = selected.length > 0;

  // Jusqu'à trois, la puce nomme ce qui est retenu -- c'est le cas courant, et
  // « 2 mesures » obligeait à rouvrir la feuille pour savoir lesquelles.
  // Au-delà, la liste dépasserait la largeur : le compte redevient plus lisible.
  const label =
    selected.length === 0
      ? emptyLabel
      : selected.length <= 3
        ? selected.map(nameOf).join(' · ')
        : `${selected.length} ${plural}`;

  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'h-11 max-w-full flex-row items-center gap-2 self-start rounded-full border px-4',
        active
          ? 'border-primary-ink bg-primary-soft dark:border-primary-ink-dark dark:bg-primary-soft-dark'
          : 'border-border bg-surface dark:border-border-dark dark:bg-surface-dark',
      )}
    >
      <Text
        className={cn(
          'shrink font-medium text-[14px]',
          active
            ? 'text-primary-ink dark:text-primary-ink-dark'
            : 'text-muted dark:text-muted-dark',
        )}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Une feuille de choix multiple : une grille d'options, et deux actions.
 *
 * Chaque touche prend effet immédiatement plutôt qu'à la validation -- le
 * bouton de droite peut alors annoncer l'état réel (« 12 résultats »,
 * « 3 mesures »), et non une promesse à vérifier en fermant.
 */
export function OptionSheet({
  visible,
  title,
  options,
  selected,
  clearLabel,
  confirmLabel,
  onToggle,
  onClear,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: readonly Option[];
  selected: readonly string[];
  clearLabel: string;
  confirmLabel: string;
  onToggle: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/50" onPress={onClose} />

      <View className="gap-3 rounded-t-3xl border-t border-border bg-background px-5 pb-8 pt-5 dark:border-border-dark dark:bg-background-dark">
        <Text className="text-center font-extrabold text-heading text-ink dark:text-ink-dark">
          {title}
        </Text>

        <ScrollView className="max-h-96 grow-0" contentContainerClassName="flex-row flex-wrap gap-2">
          {options.map((option) => {
            const on = selected.includes(option.id);
            return (
              <Pressable
                key={option.id}
                onPress={() => onToggle(option.id)}
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
                  {option.name}
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
              {clearLabel}
            </Text>
          </Pressable>
          <Pressable
            onPress={onClose}
            className="min-h-action flex-1 items-center justify-center rounded-lg bg-primary"
          >
            <Text className="font-bold text-[15px] text-ink">{confirmLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
