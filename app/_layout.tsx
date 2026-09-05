import { Tabs } from 'expo-router';

/**
 * Layout racine : avec expo-router, l'ARBORESCENCE DES FICHIERS définit la
 * navigation. Ce fichier décrit ce qui entoure les écrans du dossier -- ici,
 * une barre d'onglets.
 *
 * app/index.tsx      -> onglet "Exercices"
 * app/workouts/      -> onglet "Entraînements"
 */
export default function RootLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#2563eb' }}>
      <Tabs.Screen name="index" options={{ title: 'Exercices' }} />
      <Tabs.Screen name="workouts" options={{ title: 'Entraînements', headerShown: false }} />
    </Tabs>
  );
}
