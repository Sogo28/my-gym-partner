import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { usePalette } from './palette';
import { Pop } from './pop';

/** Une ligne de la carte : ce qui a été battu, ce qui l'a battu. */
export type RecordRow = {
  readonly key: string;
  /** Ce sur quoi porte le record : un exercice, une mesure. */
  readonly label: string;
  /** L'ancien record, déjà mis en forme -- null s'il n'y en avait pas. */
  readonly from: string | null;
  /** Le record, déjà mis en forme. */
  readonly to: string;
};

/**
 * Des records, sur un fond vert pâle : le vert des choses faites, mais à
 * plat -- une teinte, pas un aplat vif. La carte se distingue des autres
 * sans crier ; seuls le titre et le trophée portent le vert franc.
 *
 * Chaque ligne se lit comme un progrès, « 13 reps → 14 reps » : l'ancien en
 * petit et atténué, le nouveau en gras. Un record sans prédécesseur ne
 * montre que lui-même.
 */
export function RecordsCard({
  title,
  rows,
  celebrate = false,
}: {
  title: string;
  rows: readonly RecordRow[];
  /** La carte arrive en rebondissant : au bilan d'une séance qu'on vient de finir. */
  celebrate?: boolean;
}) {
  const { success } = usePalette();

  return (
    <Pop appear={celebrate} className="gap-3 rounded-2xl bg-success-soft p-4 dark:bg-success-soft-dark">
      <View className="flex-row items-center gap-2">
        <Ionicons name="trophy" size={18} color={success} />
        <Text className="font-black uppercase text-label text-success dark:text-success-dark">
          {title}
        </Text>
      </View>

      {rows.map((row) => (
        <View key={row.key} className="flex-row items-baseline justify-between gap-3">
          <Text className="shrink font-bold text-body text-ink dark:text-ink-dark" numberOfLines={1}>
            {row.label}
          </Text>
          <Text className="shrink-0" style={{ fontVariant: ['tabular-nums'] }}>
            {row.from !== null && (
              <Text className="font-mono text-caption text-muted dark:text-muted-dark">
                {row.from} →{' '}
              </Text>
            )}
            <Text className="font-mono-bold text-lead text-ink dark:text-ink-dark">{row.to}</Text>
          </Text>
        </View>
      ))}
    </Pop>
  );
}
