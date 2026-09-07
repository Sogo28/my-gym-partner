import { Pressable, Text, View } from 'react-native';
import { Card } from './card';

/**
 * Une entrée d'un catalogue tiers, proposée sous tes propres exercices.
 *
 * Même dessin partout : la liste du catalogue et le sélecteur d'exercices
 * proposent la même chose, et le geste doit se reconnaître de l'un à l'autre.
 */
export function CatalogueRow({
  name,
  detail,
  busy = false,
  onPress,
}: {
  name: string;
  detail: string;
  busy?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="pb-2">
      <Card className="flex-row items-center gap-3">
        <View className="flex-1 gap-1">
          <Text className="font-bold text-[16px] text-ink dark:text-ink-dark" numberOfLines={1}>
            {name}
          </Text>
          <Text className="font-mono text-[11px] text-muted dark:text-muted-dark" numberOfLines={1}>
            {detail}
          </Text>
        </View>
        <Text className="shrink-0 text-[13px] text-primary-ink dark:text-primary-ink-dark">
          {busy ? '…' : 'ajouter'}
        </Text>
      </Card>
    </Pressable>
  );
}
