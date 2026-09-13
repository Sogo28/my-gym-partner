import { useEffect, useRef } from 'react';
import {
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { cn } from './cn';
export { ladder } from './set-defaults';

/** La hauteur d'un cran. Trois tiennent dans la fenêtre : le choisi, et ses voisins. */
const ITEM = 44;
const VISIBLE = 3;

/**
 * Une colonne de valeurs qui s'arrête sur un cran.
 *
 * L'aimantation vient de `snapToInterval` : le défilement s'arrête toujours
 * PILE sur une valeur, jamais entre deux. La valeur retenue se déduit alors
 * de la position, ce qui évite d'avoir à deviner sur quoi l'oeil s'est posé.
 *
 * Écrite ici plutôt que prise ailleurs : le composant standard rend bien une
 * roulette sur iOS mais une liste déroulante sur Android, et toute
 * bibliothèque tierce serait un module natif -- donc une reconstruction à
 * chaque correction. Celle-ci n'est que du JavaScript, et part par une mise à
 * jour.
 */
export function Wheel({
  values,
  value,
  onChange,
  unit,
  width = 76,
}: {
  readonly values: readonly number[];
  value: number;
  onChange: (value: number) => void;
  /** Affiché sous la colonne. Absent pour une colonne qui se lit seule. */
  unit?: string;
  width?: number;
}) {
  const list = useRef<ScrollView>(null);
  // Le cran le plus PROCHE, et non l'égal : une valeur saisie autrement peut
  // tomber entre deux crans -- 61 kg sur une colonne de deux kilos et demi.
  const selected = nearest(values, value);

  // La position de départ, posée sans animation : la roulette doit s'ouvrir
  // DÉJÀ sur la valeur courante, pas défiler jusqu'à elle sous les yeux.
  useEffect(() => {
    const timer = setTimeout(
      () => list.current?.scrollTo({ y: selected * ITEM, animated: false }),
      0,
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const landed = Math.round(event.nativeEvent.contentOffset.y / ITEM);
    const index = Math.min(Math.max(landed, 0), values.length - 1);
    if (values[index] !== value) onChange(values[index]);
  };

  return (
    <View className="items-center gap-1">
      <View style={{ height: ITEM * VISIBLE, width }} className="justify-center">
        {/* Le cran retenu, désigné par un aplat derrière la colonne : c'est
            lui qui dit où regarder, sans rien ajouter à ce qui défile. */}
        <View
          pointerEvents="none"
          style={{ height: ITEM }}
          className="absolute inset-x-0 rounded-lg bg-primary-soft dark:bg-primary-soft-dark"
        />

        <ScrollView
          ref={list}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM}
          decelerationRate="fast"
          // Une hauteur de cran en haut et en bas : la première et la dernière
          // valeur peuvent alors se placer au centre comme les autres.
          contentContainerStyle={{ paddingVertical: ITEM }}
          onMomentumScrollEnd={settle}
          // Un glissement lent s'arrête sans élan : sans cela, la valeur ne
          // suivrait pas.
          onScrollEndDrag={settle}
        >
          {values.map((entry, index) => (
            <View key={entry} style={{ height: ITEM }} className="items-center justify-center">
              <Text
                className={cn(
                  'font-mono-bold',
                  index === selected
                    ? 'text-heading text-ink dark:text-ink-dark'
                    : 'text-lead text-planned dark:text-planned-dark',
                )}
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {entry}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {unit && <Text className="text-caption text-muted dark:text-muted-dark">{unit}</Text>}
    </View>
  );
}

function nearest(values: readonly number[], value: number): number {
  let best = 0;
  for (let index = 1; index < values.length; index += 1) {
    if (Math.abs(values[index] - value) < Math.abs(values[best] - value)) best = index;
  }
  return best;
}
