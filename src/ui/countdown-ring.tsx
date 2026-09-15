import { Text, useColorScheme, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { formatClock } from './format';

const SIZE = 220;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * L'anneau d'un round d'EMOM : une horloge d'une minute (ou de tout autre
 * intervalle), qui se vide toute seule -- elle ne demande rien, elle montre
 * juste ce qu'il reste.
 */
export function CountdownRing({
  remainingSeconds,
  totalSeconds,
}: {
  remainingSeconds: number;
  totalSeconds: number;
}) {
  const dark = useColorScheme() === 'dark';
  const fraction = totalSeconds > 0 ? Math.max(0, Math.min(1, remainingSeconds / totalSeconds)) : 0;
  const offset = CIRCUMFERENCE * (1 - fraction);

  return (
    <View style={{ width: SIZE, height: SIZE }} className="items-center justify-center">
      <Svg width={SIZE} height={SIZE} style={{ position: 'absolute' }}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={dark ? '#2A2D28' : '#DDE0D6'}
          strokeWidth={STROKE}
          fill="none"
        />
        {/* Tournée de -90° : le round commence à midi, pas à trois heures. */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={dark ? '#BFF04A' : '#46600F'}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={offset}
          fill="none"
          rotation={-90}
          origin={`${SIZE / 2}, ${SIZE / 2}`}
        />
      </Svg>
      <Text
        className="font-mono-bold text-[56px] leading-[60px] tracking-tighter text-ink dark:text-ink-dark"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {formatClock(remainingSeconds)}
      </Text>
    </View>
  );
}
