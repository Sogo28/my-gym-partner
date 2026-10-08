import { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { cn } from './cn';
import { feelSelection } from './haptics';
export { ladder } from './set-defaults';

/** La hauteur d'un cran. Trois tiennent dans la fenêtre : le choisi, et ses voisins. */
const ITEM = 44;
const VISIBLE = 3;
/**
 * Le nombre de copies posées bout à bout pour une colonne en boucle : assez
 * de marge de part et d'autre de la copie du milieu pour qu'un défilement,
 * même vif, n'atteigne jamais le bord d'une copie -- ce qui trahirait la
 * boucle en la faisant buter.
 */
const LOOP_COPIES = 5;

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
  loop = false,
}: {
  readonly values: readonly number[];
  value: number;
  onChange: (value: number) => void;
  /** Affiché sous la colonne. Absent pour une colonne qui se lit seule. */
  unit?: string;
  width?: number;
  /**
   * Une colonne qui reprend à zéro après le dernier cran, et inversement --
   * les secondes d'une durée n'ont pas de bord, contrairement à des
   * répétitions ou un poids, qui s'arrêtent bien quelque part.
   */
  loop?: boolean;
}) {
  const list = useRef<ScrollView>(null);
  // Le cran le plus PROCHE, et non l'égal : une valeur saisie autrement peut
  // tomber entre deux crans -- 61 kg sur une colonne de deux kilos et demi.
  const selected = nearest(values, value);
  const count = values.length;

  // En boucle, la colonne est posée en plusieurs copies bout à bout : le
  // défilement continue visuellement au-delà d'une copie, jamais contre un
  // bord. La copie du milieu sert de référence pour rester loin des bords
  // des copies voisines, jamais visitées par un geste normal.
  const displayed = loop
    ? Array.from({ length: count * LOOP_COPIES }, (_, i) => values[i % count])
    : values;
  const middleCopyStart = loop ? count * Math.floor(LOOP_COPIES / 2) : 0;

  /**
   * Le cran SOUS LA BANDE, pendant qu'on défile -- et non la valeur retenue.
   *
   * C'est lui qui s'affiche en gras. Avant, le gras restait sur l'ancienne
   * valeur jusqu'à l'arrêt : il glissait avec la colonne, hors de la bande,
   * et le chiffre actif semblait décalé dans sa cellule.
   */
  const [centered, setCentered] = useState(middleCopyStart + selected);
  const lastCentered = useRef(centered);
  // Une valeur changée d'ailleurs -- les crans « + / - » -- recentre le gras.
  useEffect(() => {
    lastCentered.current = middleCopyStart + selected;
    setCentered(middleCopyStart + selected);
  }, [middleCopyStart, selected]);

  const follow = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const raw = Math.round(event.nativeEvent.contentOffset.y / ITEM);
    const index = loop ? raw : Math.min(Math.max(raw, 0), count - 1);
    if (index === lastCentered.current) return;
    // Le retour silencieux vers la copie du milieu (voir `settle`) change de
    // copie sans changer de valeur : rien n'a été franchi, rien ne vibre.
    const sameValue = loop && (index - lastCentered.current) % count === 0;
    lastCentered.current = index;
    setCentered(index);
    // Un cran franchi se sent, comme celui d'une vraie molette : on peut
    // compter sans regarder.
    if (!sameValue) feelSelection();
  };

  // La position de départ, posée sans animation : la roulette doit s'ouvrir
  // DÉJÀ sur la valeur courante, pas défiler jusqu'à elle sous les yeux.
  useEffect(() => {
    const timer = setTimeout(
      () => list.current?.scrollTo({ y: (middleCopyStart + selected) * ITEM, animated: false }),
      0,
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = event.nativeEvent.contentOffset.y;
    const landed = Math.round(offset / ITEM);
    const index = loop
      ? ((landed % count) + count) % count
      : Math.min(Math.max(landed, 0), count - 1);
    if (values[index] !== value) onChange(values[index]);

    // Ramène silencieusement vers la copie du milieu : le cran affiché ne
    // change pas -- même valeur, même position à l'écran --, seule la copie
    // sous le doigt change, pour regagner la marge dont un futur défilement
    // aura besoin.
    if (loop && landed !== middleCopyStart + index) {
      list.current?.scrollTo({ y: (middleCopyStart + index) * ITEM, animated: false });
      return;
    }
    // Arrêté entre deux crans -- un glissement lâché sans élan, qu'Android
    // n'aimante pas toujours : on finit le geste jusqu'au cran.
    if (Math.abs(offset - landed * ITEM) > 0.5) {
      list.current?.scrollTo({ y: landed * ITEM, animated: true });
    }
  };

  /** Un glissement lâché SANS élan s'arrête là : rien ne suivra pour l'aimanter. */
  const release = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const velocity = event.nativeEvent.velocity?.y ?? 0;
    if (Math.abs(velocity) < 0.05) settle(event);
  };

  return (
    <View className="items-center gap-1">
      <View style={{ height: ITEM * VISIBLE, width }}>
        {/* Le cran retenu, désigné par un aplat derrière la colonne : c'est
            lui qui dit où regarder, sans rien ajouter à ce qui défile. */}
        {/* Posé à une hauteur de cran du haut, en dur : laissé au centrage
            de la mise en page, il ne tombait pas pile sur le cran du milieu,
            et le chiffre retenu semblait décalé dans sa cellule. */}
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: ITEM, left: 0, right: 0, height: ITEM }}
          className="rounded-lg bg-primary-soft dark:bg-primary-soft-dark"
        />

        <ScrollView
          ref={list}
          style={{ height: ITEM * VISIBLE }}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM}
          decelerationRate="fast"
          // Une hauteur de cran en haut et en bas : la première et la dernière
          // valeur peuvent alors se placer au centre comme les autres.
          contentContainerStyle={{ paddingVertical: ITEM }}
          onScroll={follow}
          scrollEventThrottle={16}
          onMomentumScrollEnd={settle}
          // Un glissement lent s'arrête sans élan : sans cela, la valeur ne
          // suivrait pas. Avec élan, c'est la fin de l'élan qui tranche --
          // trancher aussi au lâcher retenait un cran intermédiaire.
          onScrollEndDrag={release}
        >
          {displayed.map((entry, index) => (
            <View key={index} style={{ height: ITEM }} className="items-center justify-center">
              <Text
                className={cn(
                  'font-mono-bold',
                  index === centered
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
