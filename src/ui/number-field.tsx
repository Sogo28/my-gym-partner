import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { cn } from './cn';
import { Sheet } from './sheet';
import { ladder, Wheel } from './wheel';

type NumberFieldProps = {
  value: number;
  onChange: (value: number) => void;
  /** L'unité affichée sous la valeur : reps, kg, s... */
  unit: string;
  /** Titre au-dessus du champ (« Côté gauche », « Poids »...). */
  label?: string;
  step?: number;
  /**
   * Version basse, pour une LIGNE de champs : en construisant un
   * entraînement, on empile quatre séries de deux valeurs -- à pleine
   * hauteur, la page ne montrerait plus qu'un exercice à la fois.
   */
  compact?: boolean;
  /**
   * Jusqu'où la roulette monte. Absent : le nombre n'en ouvre aucune.
   *
   * C'est la mesure qui le sait -- deux cents répétitions, quatre cents
   * kilos -- et non le champ, qui ne connaît qu'un pas et une unité.
   */
  ceiling?: number;
  /**
   * La roulette vient de se refermer.
   *
   * Quand elle est TOUT le réglage -- une seule mesure sur cette série --,
   * l'écran qui la tenait ouverte peut relâcher la série du même geste, au
   * lieu d'attendre un second tap qui ne dirait rien de plus. À plusieurs
   * mesures, l'appelant ne le passe pas : refermer les répétitions ramène au
   * poids, qui reste à régler.
   */
  onDone?: () => void;
};

/**
 * Saisie par pas plutôt qu'au clavier : en salle, on ajuste de quelques
 * répétitions ou de quelques kilos, on ne tape pas un nombre.
 *
 * Le champ affiche la valeur RÉELLEMENT enregistrée et l'écrit à chaque
 * ajustement : il n'y a rien à confirmer, donc rien à oublier de confirmer.
 */
export function NumberField({
  value,
  onChange,
  unit,
  label,
  step = 1,
  compact = false,
  ceiling,
  onDone,
}: NumberFieldProps) {
  const [picking, setPicking] = useState(false);
  return (
    <View className="flex-1 gap-1">
      {label && (
        <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
          {label}
        </Text>
      )}

      <View className={fieldBox(compact)}>
        <StepButton
          icon="remove"
          compact={compact}
          onPress={() => onChange(Math.max(0, round(value - step)))}
        />

        {/* Le nombre lui-même ouvre une roulette.
            Les flèches servent le cas courant -- la valeur arrive déjà
            presque bonne, reprise de la série précédente, et l'on ajuste d'un
            ou deux crans. Mais poser 2 km quand on part de 100 m demanderait
            cent quatre-vingt-dix taps : pour ce saut-là, il faut viser, pas
            avancer. Le trait sous le nombre dit qu'on peut le toucher. */}
        <Pressable
          onPress={() => ceiling !== undefined && setPicking(true)}
          disabled={ceiling === undefined}
          className={cn(
            'shrink items-center justify-center',
            ceiling !== undefined && TAPPABLE,
          )}
        >
          <Text
            className={cn(
              'font-mono-bold text-ink dark:text-ink-dark',
              compact ? 'text-lead' : 'text-heading',
            )}
            style={{ fontVariant: ['tabular-nums'] }}
            numberOfLines={1}
          >
            {value}
            <Text className="font-sans text-small text-muted dark:text-muted-dark"> {unit}</Text>
          </Text>
        </Pressable>

        <StepButton icon="add" compact={compact} onPress={() => onChange(round(value + step))} />
      </View>

      {ceiling !== undefined && (
        <Sheet
          visible={picking}
          title={label ?? 'Choisir'}
          description={`${value} ${unit}`}
          onClose={() => {
            setPicking(false);
            onDone?.();
          }}
        >
          <View className="items-center pb-2">
            <Wheel values={ladder(step, ceiling)} unit={unit} value={value} onChange={onChange} width={110} />
          </View>
        </Sheet>
      )}
    </View>
  );
}

/** Évite 7.500000000000001 quand on ajoute des pas de 2,5. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Le cadre d'un champ de mesure, et ses boutons de pas.
 *
 * Partagés avec le champ de durée : les deux sont le MÊME contrôle -- un pas
 * de part et d'autre, une valeur au milieu qui ouvre de quoi la choisir. Seule
 * diffère la façon dont la valeur se lit et ce qui s'ouvre en la touchant.
 */
export function fieldBox(compact: boolean): string {
  return cn(
    'flex-row items-center justify-between rounded-lg border-2',
    'border-border bg-surface px-3 dark:border-border-dark dark:bg-surface-dark',
    compact ? 'h-[40px] px-2' : 'h-[56px]',
  );
}

export function StepButton({
  icon,
  compact,
  onPress,
}: {
  icon: 'add' | 'remove';
  compact: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      className={cn('items-center justify-center', compact ? 'h-8 w-7' : 'h-10 w-8')}
    >
      <Ionicons name={icon} size={compact ? 17 : 20} color="#8B9086" />
    </Pressable>
  );
}

/** Le trait pointillé qui dit qu'une valeur s'ouvre. */
export const TAPPABLE =
  'border-b border-dashed border-border-strong dark:border-border-strong-dark';
