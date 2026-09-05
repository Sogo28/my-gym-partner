import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

/**
 * Un refus métier : "Termine l'exercice en cours avant d'en commencer un autre".
 *
 * Affiché à sa place dans le flux, juste au-dessus de l'action, jamais en
 * modale et jamais en rouge : c'est une information sur la règle, pas une
 * panne de l'application.
 */
export function BusinessNotice({ message, detail }: { message: string; detail?: string }) {
  return (
    <View className="flex-row gap-3 rounded-xl border-l-[3px] border-l-primary-ink bg-surface-alt p-3.5 dark:border-l-primary-ink-dark dark:bg-[#1D1F1A]">
      <Ionicons name="information-circle-outline" size={20} color="#46600F" />
      <View className="shrink gap-1">
        <Text className="font-bold text-[15px] text-ink dark:text-ink-dark">{message}</Text>
        {detail && (
          <Text className="text-[13px] text-muted dark:text-muted-dark">{detail}</Text>
        )}
      </View>
    </View>
  );
}
