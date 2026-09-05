import { Text, View } from 'react-native';

/** Formate des secondes en mm:ss, toujours sur deux chiffres. */
export function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(Math.max(totalSeconds, 0) / 60);
  const seconds = Math.max(totalSeconds, 0) % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Le chrono de repos : l'élément le plus grand de l'écran C.
 *
 * Chiffres tabulaires pour que la largeur ne bouge pas d'une seconde à
 * l'autre -- sinon le reste de la ligne se décale sans arrêt.
 */
export function Timer({ seconds, title = 'Repos' }: { seconds: number; title?: string }) {
  return (
    <View>
      <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">{title}</Text>
      <Text
        className="font-mono-bold text-timer tracking-tighter text-primary-ink dark:text-primary-ink-dark"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {formatClock(seconds)}
      </Text>
    </View>
  );
}
