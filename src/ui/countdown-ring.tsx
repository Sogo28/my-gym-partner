import { Text, useColorScheme, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { formatClock } from './format';

/**
 * Les proportions de l'anneau, et non ses dimensions.
 *
 * Le dessin est décrit une fois dans ce repère, et le `viewBox` du SVG le
 * met à l'échelle de la place qu'on lui donne : les nombres ci-dessous ne
 * sont donc jamais des pixels, sauf quand l'anneau reçoit sa taille de
 * référence.
 */
const REFERENCE = 220;
const STROKE = 14;
const DIGITS = 56;
const RADIUS = (REFERENCE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** En dessous, il ne reste plus d'anneau à regarder : on n'y descend pas. */
const SMALLEST = 96;

/**
 * L'anneau d'un round d'EMOM : une horloge d'une minute (ou de tout autre
 * intervalle), qui se vide toute seule -- elle ne demande rien, elle montre
 * juste ce qu'il reste.
 *
 * Il prend la taille qu'on lui donne, au lieu de l'imposer. Une taille en dur
 * tenait sur les écrans où elle avait été choisie et débordait sur les
 * autres : l'anneau montait sur la dernière série au-dessus, et le rang du
 * round passait sous la barre du bas. Ce qui déborde n'est pas seulement
 * laid -- sur Android, ce qui sort des bornes de son parent est dessiné mais
 * ne reçoit plus les touches.
 */
export function CountdownRing({
  remainingSeconds,
  totalSeconds,
  size = REFERENCE,
}: {
  remainingSeconds: number;
  totalSeconds: number;
  /** Le côté du carré où il doit tenir. Absent : sa taille de référence. */
  size?: number;
}) {
  const dark = useColorScheme() === 'dark';
  const fraction = totalSeconds > 0 ? Math.max(0, Math.min(1, remainingSeconds / totalSeconds)) : 0;
  const offset = CIRCUMFERENCE * (1 - fraction);

  // Le SVG se met à l'échelle tout seul ; le texte, non : il lui faut des
  // pixels, calculés dans le même rapport que le reste du dessin.
  const side = Math.max(SMALLEST, size);
  const scale = side / REFERENCE;

  return (
    <View style={{ width: side, height: side }} className="items-center justify-center">
      <Svg
        width={side}
        height={side}
        viewBox={`0 0 ${REFERENCE} ${REFERENCE}`}
        style={{ position: 'absolute' }}
      >
        <Circle
          cx={REFERENCE / 2}
          cy={REFERENCE / 2}
          r={RADIUS}
          stroke={dark ? '#2A2D28' : '#DDE0D6'}
          strokeWidth={STROKE}
          fill="none"
        />
        {/* Tournée de -90° : le round commence à midi, pas à trois heures. */}
        <Circle
          cx={REFERENCE / 2}
          cy={REFERENCE / 2}
          r={RADIUS}
          stroke={dark ? '#F2F4EF' : '#14160F'}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={offset}
          fill="none"
          rotation={-90}
          origin={`${REFERENCE / 2}, ${REFERENCE / 2}`}
        />
      </Svg>
      <Text
        className="font-mono-bold tracking-tighter text-ink dark:text-ink-dark"
        style={{
          fontVariant: ['tabular-nums'],
          fontSize: Math.round(DIGITS * scale),
          lineHeight: Math.round(DIGITS * scale * 1.07),
        }}
      >
        {formatClock(remainingSeconds)}
      </Text>
    </View>
  );
}

/**
 * La taille que l'anneau peut prendre dans la place mesurée.
 *
 * Calculée par celui qui connaît le budget -- la zone qui l'accueille --, et
 * non par l'anneau, qui ne sait pas ce qu'on pose sous lui.
 */
export function ringSizeIn(
  box: { width: number; height: number } | null,
  reservedBelow = 0,
): number {
  if (!box) return REFERENCE;
  return Math.max(
    SMALLEST,
    Math.min(REFERENCE, box.width, box.height - reservedBelow),
  );
}
