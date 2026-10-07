import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { cn } from './cn';
import { usePalette } from './palette';
import { SearchField } from './search';
import { SheetFrame } from './sheet-frame';

export type SheetAction = {
  label: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
  /** Une icône devant le libellé, quand elle aide à le reconnaître. */
  icon?: keyof typeof Ionicons.glyphMap;
};

/**
 * Une feuille d'actions qui remonte du bas.
 *
 * Remplace Alert.alert, qui rend un dialogue système : impossible à styler, et
 * surtout limité à TROIS boutons sur Android -- les suivants sont ignorés sans
 * le moindre avertissement, y compris celui qui ferme la boîte.
 */
export function Sheet({
  visible,
  title,
  description,
  actions,
  onClose,
  searchPlaceholder,
  children,
}: {
  visible: boolean;
  title: string;
  description?: string;
  actions?: SheetAction[];
  onClose: () => void;
  /** Fourni : la liste devient filtrable. Utile au-delà de quelques entrées. */
  searchPlaceholder?: string;
  /** Contenu libre, pour une feuille qui n'est pas une liste d'actions. */
  children?: ReactNode;
}) {
  const [query, setQuery] = useState('');

  // Repartir d'une recherche vide à chaque ouverture.
  useEffect(() => {
    if (visible) setQuery('');
  }, [visible]);

  const all = actions ?? [];
  const shown = searchPlaceholder
    ? all.filter((action) => action.label.toLowerCase().includes(query.trim().toLowerCase()))
    : all;

  return (
    <SheetFrame visible={visible} onClose={onClose}>
      <View className="gap-1 pb-4">
        <Text className="font-extrabold text-heading text-ink dark:text-ink-dark">{title}</Text>
        {description && (
          <Text className="text-small text-muted dark:text-muted-dark">{description}</Text>
        )}
      </View>

      {searchPlaceholder && (
        <View className="pb-3">
          <SearchField value={query} onChange={setQuery} placeholder={searchPlaceholder} />
        </View>
      )}

      {children}

      {/* La liste défile plutôt que de pousser le panneau hors de l'écran. */}
      <ScrollView className="max-h-80 grow-0" keyboardShouldPersistTaps="handled">
        {shown.length === 0 && searchPlaceholder && (
          <Text className="py-2 text-small text-muted dark:text-muted-dark">Aucun résultat.</Text>
        )}
        {shown.map((action) => (
          <SheetRow
            key={action.label}
            label={action.label}
            icon={action.icon}
            tone={action.tone}
            onPress={() => {
              onClose();
              action.onPress();
            }}
          />
        ))}
      </ScrollView>
    </SheetFrame>
  );
}

/**
 * Une ligne de panneau : une icône facultative, un libellé, rien autour.
 *
 * Plus de cadre par ligne : empilés, ils faisaient une colonne de boutons
 * qu'on lisait comme un formulaire. Un appui grise la ligne -- c'est le seul
 * signe qu'il a pris. Une action destructrice est en rouge, icône comprise.
 */
export function SheetRow({
  label,
  icon,
  tone = 'default',
  right,
  onPress,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: 'default' | 'danger';
  /** Ce qui se pose au bout de la ligne : une case à cocher, par exemple. */
  right?: ReactNode;
  onPress: () => void;
}) {
  const { ink, danger } = usePalette();

  return (
    <Pressable
      onPress={onPress}
      className="min-h-touch flex-row items-center gap-3 rounded-lg px-2 active:bg-surface-alt dark:active:bg-surface-alt-dark"
    >
      {icon && <Ionicons name={icon} size={20} color={tone === 'danger' ? danger : ink} />}
      {/* Ce sont des boutons : leur libellé est celui des boutons. */}
      <Text
        className={cn(
          'shrink grow font-extrabold text-body',
          tone === 'danger' ? 'text-danger dark:text-danger-dark' : 'text-ink dark:text-ink-dark',
        )}
        numberOfLines={1}
      >
        {label}
      </Text>
      {right}
    </Pressable>
  );
}
