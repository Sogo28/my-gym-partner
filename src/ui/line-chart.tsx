import { Text, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { chartScale, curveOffsets } from './scale';

export type ChartPoint = { value: number; at: Date };

/** La hauteur du tracé. Assez pour lire une pente, pas assez pour voler la page. */
const HEIGHT = 140;
/** La largeur réservée aux graduations verticales, à gauche du tracé. */
const GUTTER = 42;

/**
 * Une progression, en courbe, dans un repère gradué.
 *
 * En abscisse les SÉANCES, pas le temps : à intervalle régulier quel que soit
 * le nombre de jours qui les sépare. Deux séances d'un même jour occupent donc
 * deux positions et ne se recouvrent pas -- sur un axe de temps, la seconde
 * disparaîtrait derrière la première.
 *
 * En ordonnée l'échelle réelle, graduée. Elle ne part pas de zéro : entre 700
 * et 720, une courbe partie de zéro serait plate. Les graduations portent les
 * nombres, si bien que la base tronquée se voit au lieu de tromper.
 */
export function LineChart({ points }: { points: readonly ChartPoint[] }) {
  if (points.length === 0) return null;

  const values = points.map((point) => point.value);
  const { floor, max } = chartScale(values);
  const offsets = curveOffsets(values);

  // Un plateau n'a qu'un niveau à nommer : trois graduations identiques
  // donneraient à croire à une échelle là où il n'y en a plus.
  const levels = floor === max ? [max] : [max, (max + floor) / 2, floor];

  const y = (offset: number) => (offset / 100) * HEIGHT;
  // Un point unique se pose au milieu plutôt qu'au bord gauche.
  const x = (index: number) =>
    points.length === 1 ? 50 : (index / (points.length - 1)) * 100;

  const line = offsets
    .map((offset, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(offset)}`)
    .join(' ');

  return (
    <View className="gap-1">
      <View className="flex-row">
        {/* Les graduations verticales, hors du tracé : dedans, elles
            s'étireraient avec lui. */}
        <View style={{ width: GUTTER, height: HEIGHT }}>
          {levels.map((level, index) => (
            <Text
              key={index}
              className="absolute right-2 font-mono text-micro text-muted dark:text-muted-dark"
              style={{
                top: (index / Math.max(levels.length - 1, 1)) * HEIGHT - 6,
                fontVariant: ['tabular-nums'],
              }}
              numberOfLines={1}
            >
              {round(level)}
            </Text>
          ))}
        </View>

        <View className="flex-1" style={{ height: HEIGHT }}>
          <Svg
            width="100%"
            height={HEIGHT}
            viewBox={`0 0 100 ${HEIGHT}`}
            preserveAspectRatio="none"
          >
            {/* Une ligne par graduation : elles disent où l'oeil se pose,
                sans quoi une hauteur ne se rapporte à rien. */}
            {levels.map((_, index) => {
              const at = (index / Math.max(levels.length - 1, 1)) * HEIGHT;
              return (
                <Line
                  key={index}
                  x1={0}
                  y1={at}
                  x2={100}
                  y2={at}
                  stroke="#A8AD9E"
                  strokeWidth={1}
                  strokeDasharray="2 3"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}

            <Path
              d={line}
              stroke="#46600F"
              strokeWidth={2}
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
          </Svg>

          {/* Les points par-dessus, dans leur propre repère : étirés par le
              même `preserveAspectRatio`, des cercles deviendraient des
              ovales. */}
          <View className="absolute inset-0 flex-row">
            {offsets.map((offset, index) => (
              <View
                key={index}
                className="flex-1 items-center"
                style={{ paddingTop: y(offset) - 4 }}
              >
                <View className="h-2 w-2 rounded-full bg-primary-ink dark:bg-primary-ink-dark" />
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* L'axe des séances : un cran sous chacune. */}
      <View className="flex-row">
        <View style={{ width: GUTTER }} />
        <View className="flex-1 border-t border-border dark:border-border-dark">
          <View className="flex-row">
            {points.map((_, index) => (
              <View key={index} className="flex-1 items-center">
                <View className="h-1 w-px bg-border dark:bg-border-dark" />
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Ce que l'axe des abscisses porte : des séances, dites par leur date.
          Une sur deux au-delà de six, faute de quoi elles se chevauchent. */}
      <View className="flex-row">
        <View style={{ width: GUTTER }} />
        <View className="flex-1 flex-row">
          {points.map((point, index) => (
            <View key={index} className="flex-1 items-center">
              <Text
                className="font-mono text-micro text-muted dark:text-muted-dark"
                numberOfLines={1}
              >
                {points.length <= 6 || index % 2 === 0 ? shortDate(point.at) : ''}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** « 12 août » : l'année n'aide pas à lire une progression sur douze séances. */
function shortDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
