import { View } from 'react-native';
import { cn } from './cn';

/**
 * Une progression en petits carrés : une étape, un carré.
 *
 * Comptable, donc dessinable ainsi -- c'est ce qui distingue un objectif
 * progressif d'un objectif simple, dont l'avancement n'a pas de paliers à
 * remplir.
 *
 * Trois états et non deux : les étapes passées sont pleines, celle en cours
 * est contournée, et elle se remplit quand ses conditions sont tenues -- elle
 * n'attend plus que le geste qui fait avancer.
 */
export function StepGauge({
  total,
  done,
  currentSatisfied = false,
}: {
  total: number;
  /** Le nombre d'étapes derrière soi. */
  done: number;
  currentSatisfied?: boolean;
}) {
  return (
    <View className="flex-row gap-1">
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          className={cn(
            'h-2.5 w-2.5 rounded-[3px] border',
            index < done && 'border-primary bg-primary',
            index === done &&
              (currentSatisfied
                ? 'border-primary bg-primary'
                : 'border-primary-ink dark:border-primary-ink-dark'),
            index > done && 'border-border bg-surface-alt dark:border-border-dark dark:bg-surface-alt-dark',
          )}
        />
      ))}
    </View>
  );
}
