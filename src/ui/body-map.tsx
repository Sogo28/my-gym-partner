import Body from 'react-native-body-highlighter';
import { Text, useColorScheme, View } from 'react-native';
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
export function BodyMap({ parts, scale = 0.75 }: { parts: HighlightedPart[]; scale?: number }) {
  const dark = useColorScheme() === 'dark';

  // Deux teintes, dans l'ordre des intensités : soutien, puis visé.
  const colors = dark ? ['#3F5411', '#BFF04A'] : ['#DCEBB4', '#46600F'];

  return (
    <View className="items-center gap-2">
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

      {/* Sans rien de colorié, la légende n'a rien à légender. */}
      {parts.length > 0 && (
        <View className="flex-row items-center gap-4">
          <Legend color={colors[1]} label="visé" />
          <Legend color={colors[0]} label="en soutien" />
        </View>
      )}
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <Text className="text-[11px] text-muted dark:text-muted-dark">{label}</Text>
    </View>
  );
}
