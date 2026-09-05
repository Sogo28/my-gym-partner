import { Stack } from 'expo-router';

/**
 * Une pile (Stack) à l'intérieur de l'onglet : l'écran "nouvel entraînement"
 * se pose PAR-DESSUS la liste, avec un retour arrière. C'est la différence
 * avec les onglets, qui eux placent les écrans côte à côte.
 */
export default function WorkoutsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Entraînements' }} />
      <Stack.Screen name="new" options={{ title: 'Nouvel entraînement', presentation: 'modal' }} />
    </Stack>
  );
}
