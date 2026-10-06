import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { cn } from './cn';
import { usePalette } from './palette';

/** Une entrée de la ligne : une icône qui dit CE QUE c'est, un texte qui dit combien. */
export type MetaItem = {
  readonly icon: keyof typeof Ionicons.glyphMap;
  readonly label: string;
  /** `accent` : ce qui mérite d'être remarqué, un record par exemple. */
  readonly tone?: 'default' | 'accent';
};

/**
 * La ligne de détails sous un titre de carte : « 🕒 52 min  🏋 3 exercices ».
 *
 * Au plus petit cran de l'échelle (`micro`) : elle complète le titre, elle
 * ne lui dispute rien. L'icône rend ce cran lisible -- elle dit ce qu'est le
 * chiffre avant qu'on l'ait lu --, et tient lieu de séparateur : pas de
 * points entre les entrées.
 *
 * Tout ce qui fait la ligne est réglé ici, taille, police, couleur, icône et
 * écarts : une carte qui en veut une passe ses entrées, rien d'autre.
 */
export function MetaLine({
  items,
  className,
}: {
  items: readonly MetaItem[];
  className?: string;
}) {
  const { muted, primaryInk } = usePalette();

  return (
    <View className={cn('flex-row flex-wrap items-center gap-x-3 gap-y-1', className)}>
      {items.map((item) => (
        <View key={`${item.icon}-${item.label}`} className="flex-row items-center gap-1">
          <Ionicons
            name={item.icon}
            size={12}
            color={item.tone === 'accent' ? primaryInk : muted}
          />
          <Text
            className={cn(
              'text-micro',
              item.tone === 'accent'
                ? 'font-mono-bold text-primary-ink dark:text-primary-ink-dark'
                : 'font-mono text-muted dark:text-muted-dark',
            )}
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
