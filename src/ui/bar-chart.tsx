import { Text, View } from 'react-native';
import { barHeights } from './scale';

export type ChartPoint = { value: number; at: Date };

/**
 * Un graphe en barres, dessiné avec des vues.
 *
 * Aucune bibliothèque : lire une progression demande de comparer des hauteurs,
 * pas des axes gradués. Embarquer un moteur de graphiques pour ça pèserait
 * plus lourd que tout le reste de l'écran.
 */
export function BarChart({ points, unit }: { points: readonly ChartPoint[]; unit: string }) {
  if (points.length === 0) return null;

  const values = points.map((point) => point.value);
  const max = Math.max(...values);
  const heights = barHeights(values);

  return (
    <View className="gap-2">
      <View className="h-32 flex-row items-end gap-1">
        {points.map((point, index) => (
          <View
            key={index}
            className="flex-1 rounded-t-sm bg-primary"
            style={{
              height: `${heights[index]}%`,
              // La meilleure séance ressort en plein ; les autres s'effacent
              // derrière elle sans disparaître.
              opacity: point.value === max ? 1 : 0.45,
            }}
          />
        ))}
      </View>

      <View className="flex-row items-center justify-between">
        <Text className="font-mono text-[11px] text-muted dark:text-muted-dark">
          {shortDate(points[0].at)}
        </Text>
        <Text className="font-mono text-[11px] text-muted dark:text-muted-dark">
          max {max} {unit}
        </Text>
        <Text className="font-mono text-[11px] text-muted dark:text-muted-dark">
          {shortDate(points[points.length - 1].at)}
        </Text>
      </View>
    </View>
  );
}

/** « 12 août » : l'année n'aide pas à lire une progression sur douze séances. */
function shortDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
