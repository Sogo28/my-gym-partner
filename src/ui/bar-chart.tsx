import { Text, View } from 'react-native';

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
  const min = Math.min(...values);

  /**
   * La base n'est pas zéro : entre 40 s et 45 s, des barres parties de zéro
   * se ressemblent toutes. On garde un quart de l'écart sous la plus basse,
   * pour que la plus faible reste visible sans écraser les autres.
   */
  const floor = max === min ? Math.max(0, min - 1) : min - (max - min) * 0.25;
  const heightOf = (value: number): `${number}%` =>
    `${Math.max(6, ((value - floor) / (max - floor)) * 100)}%`;

  return (
    <View className="gap-2">
      <View className="h-32 flex-row items-end gap-1">
        {points.map((point, index) => (
          <View
            key={index}
            className="flex-1 rounded-t-sm bg-primary"
            style={{
              height: heightOf(point.value),
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
