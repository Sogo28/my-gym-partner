import Body from 'react-native-body-highlighter';
import { useColorScheme, View } from 'react-native';
import type { HighlightedPart } from './body-slugs';

/**
 * Le schéma des muscles que travaille un entraînement.
 *
 * Les deux faces côte à côte : un entraînement de tirage n'éclaire presque
 * rien de face, et une planche presque rien de dos. N'en montrer qu'une
 * donnerait à la moitié des séances l'air de ne travailler personne.
 *
 * Le dessin répond à « qu'est-ce que ça travaille », qui est la question
 * qu'on se pose devant un entraînement -- et il y répond sans avoir besoin
 * d'un historique, là où toute statistique attend d'abord des séances.
 */
export function BodyMap({
  parts,
  scale = 0.75,
  done = false,
}: {
  parts: HighlightedPart[];
  scale?: number;
  /**
   * Des muscles réellement travaillés, et non visés : ils prennent le vert
   * des choses faites. Ce qu'un entraînement se propose de travailler reste
   * en gris -- une intention n'a pas la couleur d'un fait.
   */
  done?: boolean;
}) {
  const dark = useColorScheme() === 'dark';

  // Deux teintes, dans l'ordre des intensités : soutien, puis visé.
  const colors = done
    ? dark
      ? ['#1E4D33', '#4FD68A']
      : ['#CDE8D6', '#1B7A45']
    : dark
      ? ['#3A3F37', '#C3C8B8']
      : ['#D3D7CA', '#5F6459'];

  return (
    <View className="flex-row items-center justify-center gap-4">
      <Body
        data={parts}
        side="front"
        gender="male"
        scale={scale}
        colors={colors}
        border="none"
        defaultFill={dark ? '#232620' : '#E4E7DC'}
      />
      <Body
        data={parts}
        side="back"
        gender="male"
        scale={scale}
        colors={colors}
        border="none"
        defaultFill={dark ? '#232620' : '#E4E7DC'}
      />
    </View>
  );
}
