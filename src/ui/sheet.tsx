import { useEffect, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { cn } from './cn';

export type SheetAction = {
  label: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
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
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      // Le bouton retour d'Android doit fermer la feuille, sinon elle piège
      // l'utilisateur exactement comme le dialogue précédent.
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 bg-black/50" onPress={onClose} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View className="gap-2 rounded-t-3xl border-t border-border bg-background p-5 pb-8 dark:border-border-dark dark:bg-background-dark">
        <Text className="font-extrabold text-heading text-ink dark:text-ink-dark">{title}</Text>
        {description && (
          <Text className="mb-1 text-[13px] text-muted dark:text-muted-dark">{description}</Text>
        )}

        {searchPlaceholder && (
          <TextInput
            className="mb-1 h-12 rounded-lg border border-border bg-surface px-4 text-[16px] text-ink dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
            placeholder={searchPlaceholder}
            placeholderTextColor="#A8AD9E"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
        )}

        {children}

        {/* La liste défile plutôt que de pousser la feuille hors de l'écran. */}
        <ScrollView className="max-h-80 grow-0" contentContainerClassName="gap-2">
        {shown.length === 0 && searchPlaceholder && (
          <Text className="py-2 text-[13px] text-muted dark:text-muted-dark">
            Aucun résultat.
          </Text>
        )}
        {shown.map((action) => (
          <Pressable
            key={action.label}
            onPress={() => {
              onClose();
              action.onPress();
            }}
            className={cn(
              'min-h-touch justify-center rounded-lg border px-4 py-3.5',
              action.tone === 'danger'
                ? 'border-[#EAB9B5] bg-[#FDF1F0] dark:border-[#5C332B] dark:bg-[#2A1A16]'
                : 'border-border bg-surface dark:border-border-dark dark:bg-surface-dark',
            )}
          >
            <Text
              className={cn(
                'font-bold text-[16px]',
                action.tone === 'danger'
                  ? 'text-danger dark:text-danger-dark'
                  : 'text-ink dark:text-ink-dark',
              )}
            >
              {action.label}
            </Text>
          </Pressable>
        ))}
        </ScrollView>

        <Pressable onPress={onClose} className="min-h-touch items-center justify-center">
          <Text className="font-bold text-muted dark:text-muted-dark">Fermer</Text>
        </Pressable>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
