import { Text, View } from 'react-native';
import { Button } from './button';

/**
 * Ce qu'affiche une liste vide.
 *
 * Centrée dans la hauteur disponible : collée en haut, elle ressemble au
 * premier élément d'une liste qui n'existe pas. Sauf `inline`, pour une
 * section vide au milieu d'une page qui, elle, a du contenu.
 */
export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  inline = false,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  inline?: boolean;
}) {
  const card = (
    <View className="items-center gap-3 rounded-xl border border-dashed border-border-strong px-5 py-8 dark:border-border-strong-dark">
      <Text className="font-extrabold text-heading text-ink dark:text-ink-dark">{title}</Text>
      <Text className="max-w-[250px] text-center text-small text-muted dark:text-muted-dark">
        {description}
      </Text>
      {actionLabel && onAction && (
        <Button label={actionLabel} variant="secondary" size="md" onPress={onAction} className="mt-2 px-6" />
      )}
    </View>
  );

  if (inline) return card;
  // grow, et non flex-1 : la liste qui l'accueille doit pouvoir s'étirer sans
  // que l'encart écrase le peu de contenu qu'elle porte parfois à côté.
  return <View className="grow justify-center py-6">{card}</View>;
}
