import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';

/**
 * Une pile (Stack) à l'intérieur de l'onglet : l'écran "nouvel entraînement"
 * se pose PAR-DESSUS la liste, avec un retour arrière. C'est la différence
 * avec les onglets, qui eux placent les écrans côte à côte.
 */
export default function WorkoutsLayout() {
  const dark = useColorScheme() === 'dark';

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Même raison qu'à la racine : sans fond déclaré, la carte du
        // navigateur est blanche le temps de la transition.
        contentStyle: { backgroundColor: dark ? '#0E0F0D' : '#F6F7F3' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Entraînements' }} />
      <Stack.Screen name="new" options={{ title: 'Nouvel entraînement', presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Entraînement' }} />
    </Stack>
  );
}
