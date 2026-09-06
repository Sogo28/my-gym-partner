import { Text, View } from 'react-native';
import { formatClock } from './format';

/**
 * Le chrono de repos : l'élément le plus grand de l'écran C.
 *
 * Chiffres tabulaires pour que la largeur ne bouge pas d'une seconde à
 * l'autre -- sinon le reste de la ligne se décale sans arrêt.
 */
export function Timer({
  seconds,
  title = 'Repos',
  large = false,
}: {
  seconds: number;
  title?: string;
  large?: boolean;
}) {
  return (
    <View className={large ? 'items-center' : undefined}>
      <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">{title}</Text>
      <Text
        className={
          large
            ? 'font-mono-bold text-[76px] leading-[80px] tracking-tighter text-primary-ink dark:text-primary-ink-dark'
            : 'font-mono-bold text-timer tracking-tighter text-primary-ink dark:text-primary-ink-dark'
        }
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {formatClock(seconds)}
      </Text>
    </View>
  );
}
