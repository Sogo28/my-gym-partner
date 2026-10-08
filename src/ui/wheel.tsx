import WheelPicker from '@quidone/react-native-wheel-picker';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { feelSelection } from './haptics';
import { usePalette } from './palette';
export { ladder } from './set-defaults';

/** La hauteur d'un cran. */
const ITEM = 40;
/**
 * Cinq crans visibles : le choisi, et deux voisins de chaque côté qui
 * s'effacent en s'éloignant -- de quoi voir où l'on va avant d'y être.
 */
const VISIBLE = 5;

/**
 * Une colonne de valeurs qui s'arrête sur un cran.
 *
 * Confiée à `@quidone/react-native-wheel-picker` depuis le 2026-10-08. La
 * première version était faite main, sur un ScrollView aimanté : elle
 * hésitait dès qu'on la lâchait entre deux crans, et le chiffre en gras ne
 * suivait pas toujours la bande. Celle-ci est entièrement en JavaScript --
 * aucun module natif, donc aucune reconstruction --, et règle exactement ce
 * que l'autre ratait : l'aimantation, l'animation native, et le cran retenu.
 *
 * Elle ne boucle pas : les secondes d'une durée s'arrêtent à 59 au lieu de
 * repartir à 0. C'était le seul usage de la boucle, et un geste dans
 * l'autre sens y ramène.
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
  const { ink } = usePalette();
  // Les crans gardent la MÊME identité d'un rendu à l'autre, tant que leur
  // contenu ne change pas. L'écran de séance se redessine chaque seconde --
  // le chrono -- et les appelants refabriquent la liste à chaque fois : vue
  // comme neuve, elle refaisait l'aimantation de la colonne en plein geste.
  const signature = values.join(',');
  const data = useMemo(
    () => values.map((entry) => ({ value: entry, label: String(entry) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature],
  );
  // Le cran le plus PROCHE, et non l'égal : une valeur saisie autrement peut
  // tomber entre deux crans -- 61 kg sur une colonne de deux kilos et demi.
  const selected = values[nearest(values, value)];

  return (
    <View className="items-center gap-1">
      {/* Sans virtualisation : la version virtualisée ne dessinait, à
          l'ouverture, que les crans SOUS la valeur -- ceux du dessus
          restaient vides. Trois cent soixante crans au plus (les livres)
          restent légers à monter. */}
      <WheelPicker
        data={data}
        value={selected}
        width={width}
        itemHeight={ITEM}
        visibleItemCount={VISIBLE}
        // Toucher un voisin y amène : plus court qu'un glissement d'un cran.
        enableScrollByTapOnItem
        // Après un arrêt, la roulette revenait d'elle-même à la valeur reçue
        // si celle-ci n'avait pas ENCORE suivi le geste : choisir 10 puis
        // 32 la ramenait à 10. La valeur qu'on lui donne vient toujours
        // d'elle, il n'y a rien à resynchroniser.
        _enableSyncScrollAfterScrollEnd={false}
        // L'élan d'Android ralentit longuement avant de s'arrêter, et la
        // valeur n'est retenue qu'à l'arrêt : deux secondes après avoir
        // lâché. Un freinage franc la retient presque aussitôt. La propriété
        // passe telle quelle à la liste, que le type du composant ne dit pas.
        {...({ decelerationRate: 'fast' } as object)}
        onValueChanged={({ item }) => {
          if (item.value !== value) onChange(item.value);
        }}
        // Un cran franchi se sent, comme celui d'une vraie molette : on peut
        // compter sans regarder.
        onValueChanging={() => feelSelection()}
        itemTextStyle={{
          fontFamily: 'JetBrainsMono_800ExtraBold',
          fontSize: 17,
          color: ink,
          fontVariant: ['tabular-nums'],
        }}
        // Translucide : la bande se pose PAR-DESSUS les chiffres, et un aplat
        // plein masquerait celui qu'elle désigne.
        overlayItemStyle={{ backgroundColor: ink, opacity: 0.08, borderRadius: 8 }}
      />

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
