import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { formatClock } from './format';
import { usePalette } from './palette';

/** Les mêmes proportions que l'anneau d'un EMOM : les deux se succèdent à l'écran. */
const REFERENCE = 220;
const STROKE = 14;
const DIGITS = 56;
const RADIUS = (REFERENCE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SMALLEST = 96;
/** Au-delà, les points deviennent un nombre : on ne compte pas douze points. */
const MOST_DOTS = 6;

/**
 * Le repos, en tours d'anneau.
 *
 * Le chrono monte comme avant ; l'anneau, lui, se REMPLIT en un tour -- une
 * minute par défaut, le rythme du signal -- puis repart à vide. Chaque tour
 * achevé laisse un point vert sous le chrono : « deux minutes passées » se
 * lit d'un coup d'oeil depuis le banc, sans déchiffrer les chiffres.
 *
 * Le pendant de l'anneau d'un EMOM, à l'envers : celui-là se vide sur ce
 * qu'il reste, celui-ci se remplit sur ce qui est passé -- un repos n'a pas
 * de fin imposée.
 */
export function RestRing({
  elapsedSeconds,
  lapSeconds,
  size = REFERENCE,
}: {
  elapsedSeconds: number;
  /** La durée d'un tour, celle du signal. */
  lapSeconds: number;
  size?: number;
}) {
  const { ink, border, success } = usePalette();
  const laps = Math.floor(elapsedSeconds / lapSeconds);
  const fraction = (elapsedSeconds % lapSeconds) / lapSeconds;
  const offset = CIRCUMFERENCE * (1 - fraction);

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
          stroke={border}
          strokeWidth={STROKE}
          fill="none"
        />
        {/* Rien à dessiner au tout début d'un tour : un trait de longueur
            nulle laisserait quand même un point rond à midi. */}
        {fraction > 0 && (
          <Circle
            cx={REFERENCE / 2}
            cy={REFERENCE / 2}
            r={RADIUS}
            stroke={ink}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={offset}
            fill="none"
            rotation={-90}
            origin={`${REFERENCE / 2}, ${REFERENCE / 2}`}
          />
        )}
      </Svg>

      <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">Repos</Text>
      <Text
        className="font-mono-bold tracking-tighter text-ink dark:text-ink-dark"
        style={{
          fontVariant: ['tabular-nums'],
          fontSize: Math.round(DIGITS * scale),
          lineHeight: Math.round(DIGITS * scale * 1.07),
        }}
      >
        {formatClock(elapsedSeconds)}
      </Text>

      {/* La hauteur est réservée même sans point : le chrono ne saute pas
          d'une ligne à la fin du premier tour. */}
      <View className="h-3 flex-row items-center gap-1.5">
        {laps > MOST_DOTS ? (
          <>
            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: success }} />
            <Text className="font-mono-bold text-micro" style={{ color: success }}>
              {laps}
            </Text>
          </>
        ) : (
          Array.from({ length: laps }, (_, index) => (
            <View
              key={index}
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: success }}
            />
          ))
        )}
      </View>
    </View>
  );
}
