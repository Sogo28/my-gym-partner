import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Checkbox } from './checkbox';
import { cn } from './cn';
import { SheetRow } from './sheet';
import { SheetFrame } from './sheet-frame';
import { usePalette } from './palette';

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
          'shrink font-medium text-body',
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
 * Une feuille de choix : une liste d'options à cocher.
 *
 * Chaque touche prend effet immédiatement, et le panneau se referme d'un
 * geste comme tous les autres : pas de bouton pour « valider ». Ce qui reste
 * à faire d'un coup -- tout cocher, tout décocher, ne rien retenir -- est une
 * petite action à côté du titre, pas un bouton de plus en bas.
 */
export function OptionSheet({
  visible,
  title,
  summary,
  options,
  selected,
  noneLabel,
  mode = 'multiple',
  onToggle,
  onClear,
  onClose,
}: {
  visible: boolean;
  title: string;
  /**
   * Ce que le choix produit et que les cases ne disent pas : « 12 résultats »
   * pour un filtre. Ce qu'elles disent déjà (« 3 muscles ») n'a rien à
   * faire ici.
   */
  summary?: string;
  options: readonly Option[];
  selected: readonly string[];
  /** Choix unique : le nom de l'absence de choix (« Aucun »), si elle est permise. */
  noneLabel?: string;
  /** single : un seul choix, et la feuille se referme aussitôt. */
  mode?: 'multiple' | 'single';
  onToggle: (id: string) => void;
  onClear?: () => void;
  onClose: () => void;
}) {
  const { ink } = usePalette();
  const allChecked = options.length > 0 && options.every((option) => selected.includes(option.id));

  /*
   * La case du titre ne sert qu'à tout cocher ou tout décocher : cochée quand
   * tout l'est -- à la main ou par elle --, vide sinon. La toucher coche tout,
   * sauf quand tout l'est déjà : elle décoche tout.
   */
  function toggleAll() {
    if (allChecked) {
      onClear?.();
      return;
    }
    options
      .filter((option) => !selected.includes(option.id))
      .forEach((option) => onToggle(option.id));
  }

  return (
    <SheetFrame visible={visible} onClose={onClose}>
      {/* Le même retrait que les lignes (`px-2`) : la case du titre tombe
          dans la colonne des cases, et le titre au-dessus des libellés. */}
      <View className="gap-1 px-2 pb-3">
        <View className="min-h-touch flex-row items-center justify-between gap-3">
          {/* Sans la marge qu'Android ajoute d'office au-dessus et au-dessous
              des lettres : elle descendait le titre sous le centre de la
              case, alors que les deux partagent la même ligne. */}
          <Text
            className="shrink font-extrabold text-heading text-ink dark:text-ink-dark"
            style={{ includeFontPadding: false }}
          >
            {title}
          </Text>
          {mode === 'multiple' ? (
            <Pressable
              onPress={toggleAll}
              hitSlop={12}
              accessibilityLabel={allChecked ? 'Tout décocher' : 'Tout cocher'}
              className="active:opacity-50"
            >
              <Checkbox checked={allChecked} />
            </Pressable>
          ) : (
            noneLabel &&
            onClear && (
              // Choix unique : ne rien retenir. Une croix, à la place de la
              // case maîtresse -- il n'y a rien à cocher d'un coup.
              <Pressable
                onPress={() => {
                  onClear();
                  onClose();
                }}
                hitSlop={12}
                accessibilityLabel={noneLabel}
                className="h-[22px] w-[22px] items-center justify-center active:opacity-50"
              >
                <Ionicons name="close-circle-outline" size={22} color={ink} />
              </Pressable>
            )
          )}
        </View>
        {summary && (
          <Text className="font-mono text-small text-muted dark:text-muted-dark">{summary}</Text>
        )}
      </View>

      {/* Une liste, la case au bout de chaque ligne : les noms sont longs,
          et une colonne se parcourt d'un trait là où une grille renvoyait
          l'oeil de gauche à droite. */}
      <ScrollView className="max-h-96 grow-0" keyboardShouldPersistTaps="handled">
        {options.map((option) => (
          <SheetRow
            key={option.id}
            label={option.name}
            right={<Checkbox checked={selected.includes(option.id)} round={mode === 'single'} />}
            onPress={() => {
              onToggle(option.id);
              // Un choix unique n'a rien à confirmer : garder le panneau
              // ouvert demanderait un geste de plus pour rien.
              if (mode === 'single') onClose();
            }}
          />
        ))}
      </ScrollView>
    </SheetFrame>
  );
}
