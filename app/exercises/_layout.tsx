import { Stack } from 'expo-router';

/**
 * Une pile à l'intérieur de l'onglet Exercices : la fiche d'un exercice se
 * pose PAR-DESSUS le catalogue, avec un retour arrière.
 */
export default function ExercisesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[id]" options={{ title: 'Exercice' }} />
    </Stack>
  );
}
