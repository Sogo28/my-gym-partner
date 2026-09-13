import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { curveOffsets } from './scale';

export type ChartPoint = { value: number; at: Date };

/** La hauteur du tracé. Assez pour lire une pente, pas assez pour voler la page. */
const HEIGHT = 128;

/**
 * Une progression, en courbe.
 *
 * La ligne relie des séances, pas des instants : elles sont posées à
 * intervalle régulier quel que soit le temps qui les sépare. C'est un parti
 * pris -- on vient lire l'ordre et la pente, « est-ce que ça monte », pas
 * mesurer une vitesse de progression sur un axe de temps.
 *
 * Les points restent marqués : sans eux, la ligne laisserait croire à un
 * continuum entre deux séances, alors qu'il ne s'est rien passé entre elles.
 *
 * L'unité, elle, n'est pas ici : c'est la carte qui dit ce que la courbe
 * suit, et la répéter sous chaque point l'encombrerait.
 */
export function LineChart({ points }: { points: readonly ChartPoint[] }) {
  if (points.length === 0) return null;

  const values = points.map((point) => point.value);
  const max = Math.max(...values);
  const offsets = curveOffsets(values);
  // Au-delà, les nombres se toucheraient : la courbe redevient une forme, et
  // c'est très bien -- on n'y cherche plus des valeurs mais une tendance.
  const labelled = points.length <= 6;

  // Une marge en haut et en bas : un point à l'extrême serait coupé en deux
  // par le bord.
  const RADIUS = 3.5;
  const y = (offset: number) => RADIUS + (offset / 100) * (HEIGHT - RADIUS * 2);
  // Un point unique se pose au milieu plutôt qu'au bord gauche.
  const x = (index: number) =>
    points.length === 1 ? 50 : (index / (points.length - 1)) * 100;

  const line = offsets
    .map((offset, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(offset)}`)
    .join(' ');

  return (
    <View className="gap-2">
      <View style={{ height: HEIGHT }}>
        {/* La largeur suit celle du parent, la hauteur est en pixels : d'où
            un repère en pourcentage horizontalement et en pixels
            verticalement, que `preserveAspectRatio` laisse s'étirer. */}
        <Svg width="100%" height={HEIGHT} viewBox={`0 0 100 ${HEIGHT}`} preserveAspectRatio="none">
          <Path d={line} stroke="#46600F" strokeWidth={1} fill="none" vectorEffect="non-scaling-stroke" />
        </Svg>

        {/* Les points par-dessus, dans leur propre repère : étirés par le
            même `preserveAspectRatio`, des cercles deviendraient des ovales. */}
        <View className="absolute inset-0 flex-row">
          {offsets.map((offset, index) => (
            <View
              key={index}
              className="flex-1 items-center"
              style={{ paddingTop: y(offset) - RADIUS }}
            >
              <View
                className="rounded-full bg-primary-ink dark:bg-primary-ink-dark"
                style={{
                  width: RADIUS * 2,
                  height: RADIUS * 2,
                  // La meilleure séance ressort ; les autres s'effacent
                  // derrière elle sans disparaître.
                  opacity: points[index].value === max ? 1 : 0.5,
                }}
              />
            </View>
          ))}
        </View>
      </View>

      {/* Les valeurs sous la courbe, une colonne par point.

          En dessous et non collées aux points : une valeur posée près d'un
          point bas déborderait du cadre, et près d'un point haut passerait
          par-dessus la ligne. Sans elles, la courbe montrait une forme sans
          jamais dire de quoi -- deux séances égales donnaient un trait plat
          dont on ne pouvait rien tirer. */}
      {labelled && (
        <View className="flex-row">
          {points.map((point, index) => (
            <Text
              key={index}
              className="flex-1 text-center font-mono-bold text-caption text-ink dark:text-ink-dark"
              style={{ fontVariant: ['tabular-nums'] }}
              numberOfLines={1}
            >
              {round(point.value)}
            </Text>
          ))}
        </View>
      )}

      {/* Les dates encadrent la courbe, sauf quand il n'y en a qu'une à
          dire : deux séances du même jour affichaient deux fois la même date
          de part et d'autre, ce qui donnait à lire un intervalle inexistant. */}
      <View className="flex-row items-center justify-between">
        <Text className="font-mono text-caption text-muted dark:text-muted-dark">
          {shortDate(points[0].at)}
        </Text>
        {sameDay(points[0].at, points[points.length - 1].at) ? (
          <Text className="font-mono text-caption text-muted dark:text-muted-dark">
            {points.length} séances
          </Text>
        ) : (
          <>
            <Text className="font-mono text-caption text-muted dark:text-muted-dark">
              {points.length} séances
            </Text>
            <Text className="font-mono text-caption text-muted dark:text-muted-dark">
              {shortDate(points[points.length - 1].at)}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

function sameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** « 12 août » : l'année n'aide pas à lire une progression sur douze séances. */
function shortDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
