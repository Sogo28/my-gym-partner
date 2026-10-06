import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { usePalette } from './palette';

/**
 * Un refus métier : "Termine l'exercice en cours avant d'en commencer un autre".
 *
 * Affiché à sa place dans le flux, juste au-dessus de l'action, jamais en
 * modale et jamais en rouge : c'est une information sur la règle, pas une
 * panne de l'application.
 */
export function BusinessNotice({
  message,
  detail,
  children,
}: {
  message: string;
  detail?: string;
  /** Ce qu'on peut faire du constat -- un bouton --, posé dans la bulle. */
  children?: ReactNode;
}) {
  const { primaryInk } = usePalette();

  return (
    <View className="flex-row gap-3 rounded-xl border-l-[3px] border-l-primary-ink bg-surface-alt p-3.5 dark:border-l-primary-ink-dark dark:bg-[#1D1F1A]">
      <Ionicons name="information-circle-outline" size={20} color={primaryInk} />
      <View className="shrink grow gap-1">
        <Text className="font-bold text-lead text-ink dark:text-ink-dark">{message}</Text>
        {detail && (
          <Text className="text-small text-muted dark:text-muted-dark">{detail}</Text>
        )}
        {children && <View className="pt-2">{children}</View>}
      </View>
    </View>
  );
}
