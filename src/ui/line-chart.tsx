import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { chartScale, curveOffsets } from './scale';
import { usePalette } from './palette';

export type ChartPoint = { value: number; at: Date };

/** La hauteur du tracé. Assez pour lire une pente, pas assez pour voler la page. */
const HEIGHT = 160;
/** La largeur réservée aux graduations verticales, à gauche du tracé. */
const GUTTER = 36;
/** De l'air au-dessus du point le plus haut : la courbe ne frôle pas le cadre. */
const HEADROOM = 12;

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
 *
 * Une séance est toujours mise en avant -- la dernière, ou celle qu'on a
 * touchée : un point, un trait vertical, et une bulle qui dit sa date et sa
 * valeur. La courbe dit la tendance ; la bulle, le chiffre.
 */
export function LineChart({ points }: { points: readonly ChartPoint[] }) {
  const { success, surface, border } = usePalette();
  const [selected, setSelected] = useState(points.length - 1);

  // Une autre fenêtre de séances : la mise en avant revient à la dernière.
  useEffect(() => setSelected(points.length - 1), [points.length]);

  if (points.length === 0) return null;

  const values = points.map((point) => point.value);
  const { floor, max } = chartScale(values);
  const offsets = curveOffsets(values);

  // Un plateau n'a qu'un niveau à nommer : trois graduations identiques
  // donneraient à croire à une échelle là où il n'y en a plus.
  const levels = floor === max ? [max] : [max, (max + floor) / 2, floor];

  const plot = HEIGHT - HEADROOM;
  const y = (offset: number) => HEADROOM + (offset / 100) * plot;
  const levelY = (index: number) => HEADROOM + (index / Math.max(levels.length - 1, 1)) * plot;
  /** Le CENTRE de la colonne de cette séance, en pourcentage de la largeur. */
  const x = (index: number) => ((index + 0.5) / points.length) * 100;

  const coords = offsets.map((offset, index) => ({ x: x(index), y: y(offset) }));
  const line = smoothPath(coords);
  // L'aire sous la courbe, refermée sur le bas du tracé.
  const area = `${line} L ${coords[coords.length - 1].x} ${HEIGHT} L ${coords[0].x} ${HEIGHT} Z`;

  const focus = Math.min(selected, points.length - 1);
  const focusX = x(focus);
  const focusY = y(offsets[focus]);
  // La bulle se pose du côté où il reste de la place : à droite du trait si
  // le point est à gauche, et à l'opposé du point en hauteur -- en bas quand
  // il est haut, sinon elle couvrirait la courbe qui y monte.
  const onRight = focusX < 50;
  const below = focusY < HEIGHT / 2;

  const named = labelledSessions(points.length);
  // Toutes le même jour : la date ne distingue plus rien, l'heure si.
  const sameDay =
    points[0].at.toDateString() === points[points.length - 1].at.toDateString();

  return (
    <View className="gap-1">
      <View className="flex-row">
        {/* Les graduations verticales, hors du tracé : dedans, elles
            s'étireraient avec lui. */}
        <View style={{ width: GUTTER, height: HEIGHT }}>
          {levels.map((level, index) => (
            <Text
              key={index}
              className="absolute left-0 font-mono text-micro text-muted dark:text-muted-dark"
              style={{ top: levelY(index) - 7, fontVariant: ['tabular-nums'] }}
              numberOfLines={1}
            >
              {compact(level)}
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
            <Defs>
              {/* L'aire s'efface vers le bas : elle donne du corps à la
                  courbe sans lui disputer la lecture. */}
              <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={success} stopOpacity={0.28} />
                <Stop offset="1" stopColor={success} stopOpacity={0} />
              </LinearGradient>
            </Defs>

            {/* Une ligne par graduation : elles disent où l'oeil se pose,
                sans quoi une hauteur ne se rapporte à rien. */}
            {levels.map((_, index) => (
              <Line
                key={index}
                x1={0}
                y1={levelY(index)}
                x2={100}
                y2={levelY(index)}
                stroke={border}
                strokeWidth={1}
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            <Path d={area} fill="url(#area)" />

            {/* Le repère de la séance mise en avant, sur toute la hauteur. */}
            <Line
              x1={focusX}
              y1={0}
              x2={focusX}
              y2={HEIGHT}
              stroke={border}
              strokeWidth={1}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />

            <Path
              d={line}
              stroke={success}
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </Svg>

          {/* Le point, dans son propre repère : étiré par le même
              `preserveAspectRatio`, un cercle deviendrait un ovale. */}
          <View
            pointerEvents="none"
            className="absolute h-3 w-3 rounded-full"
            style={{
              left: `${focusX}%`,
              top: focusY - 6,
              marginLeft: -6,
              backgroundColor: success,
              borderWidth: 2,
              borderColor: surface,
            }}
          />

          {/* La bulle : la date et la valeur de la séance mise en avant. */}
          <View
            pointerEvents="none"
            className="absolute rounded-lg border border-border bg-surface px-2 py-1 dark:border-border-dark dark:bg-surface-dark"
            style={[
              below ? { bottom: 4 } : { top: 0 },
              onRight
                ? { left: `${focusX}%`, marginLeft: 8 }
                : { right: `${100 - focusX}%`, marginRight: 8 },
            ]}
          >
            <Text className="font-mono text-micro text-muted dark:text-muted-dark">
              {sameDay ? shortTime(points[focus].at) : shortDate(points[focus].at)}
            </Text>
            <Text
              className="font-mono-bold text-small text-ink dark:text-ink-dark"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {round(points[focus].value)}
            </Text>
          </View>

          {/* Une colonne tapable par séance : toucher la courbe met cette
              séance en avant. */}
          <View className="absolute inset-0 flex-row">
            {points.map((_, index) => (
              <Pressable
                key={index}
                className="flex-1"
                onPress={() => setSelected(index)}
                accessibilityLabel={`Séance ${index + 1}`}
              />
            ))}
          </View>
        </View>
      </View>

      {/* Ce que l'axe des abscisses porte : les séances, nommées.

          Par leur HEURE quand elles tombent le même jour : répéter six fois
          « 13 sept » ne distingue rien, et c'est l'heure qui les sépare. Par
          leur date sinon.

          Et quatre au plus, régulièrement espacées depuis la dernière. Une
          par séance se chevauchait et se tronquait en « 13 sep… ». La séance
          mise en avant est nommée en plus fort. */}
      <View className="flex-row">
        <View style={{ width: GUTTER }} />
        <View className="flex-1 flex-row">
          {points.map((point, index) => (
            <View key={index} className="flex-1 items-center">
              <Text
                className={
                  index === focus
                    ? 'font-mono-bold text-micro text-ink dark:text-ink-dark'
                    : 'font-mono text-micro text-muted dark:text-muted-dark'
                }
                numberOfLines={1}
              >
                {named.has(index) ? (sameDay ? shortTime(point.at) : shortDate(point.at)) : ''}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/**
 * Une courbe lisse qui passe PAR chaque point : chaque tronçon est une
 * courbe de Bézier dont les poignées suivent la pente des voisins
 * (Catmull-Rom). Une ligne brisée faisait de chaque séance un angle ; la
 * tendance, elle, se lit mieux en courbe.
 */
function smoothPath(points: readonly { x: number; y: number }[]): string {
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`;
  }
  return d;
}

/**
 * Les séances qui portent leur nom : quatre au plus.
 *
 * Comptées DEPUIS LA DERNIÈRE, à pas régulier : la plus récente est celle
 * qu'on cherche, et partir d'elle garantit l'écart entre deux étiquettes.
 * Partir du début et ajouter la dernière à part les faisait se toucher dès
 * que le compte tombait mal -- six séances donnaient « 13 sep…13 sep… ».
 */
function labelledSessions(total: number): Set<number> {
  const step = Math.max(1, Math.ceil(total / 4));
  const kept = new Set<number>();
  for (let index = total - 1; index >= 0; index -= step) kept.add(index);
  return kept;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Une graduation courte : « 1,2k » plutôt que « 1200 », qui ne tiendrait pas. */
function compact(value: number): string {
  if (Math.abs(value) < 1000) return `${round(value)}`;
  return `${(Math.round(value / 100) / 10).toString().replace('.', ',')}k`;
}

/** « 11:31 » : ce qui sépare deux séances d'un même jour. */
function shortTime(date: Date): string {
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** « 12 août » : l'année n'aide pas à lire une progression sur douze séances. */
function shortDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
