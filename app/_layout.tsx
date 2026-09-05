import { Tabs } from 'expo-router';
// Charge les styles Tailwind générés. Doit être importé une seule fois, ici.
import '../global.css';

/**
 * Layout racine : avec expo-router, l'ARBORESCENCE DES FICHIERS définit la
 * navigation. Ce fichier décrit ce qui entoure les écrans du dossier -- ici,
 * une barre d'onglets.
 *
 * L'ordre des <Tabs.Screen> est celui des onglets à l'écran.
 */
export default function RootLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#2563eb' }}>
      <Tabs.Screen name="session" options={{ title: 'Séance' }} />
      <Tabs.Screen name="index" options={{ title: 'Exercices' }} />
      <Tabs.Screen name="workouts" options={{ title: 'Entraînements', headerShown: false }} />
      <Tabs.Screen name="history" options={{ title: 'Historique' }} />
    </Tabs>
  );
}
