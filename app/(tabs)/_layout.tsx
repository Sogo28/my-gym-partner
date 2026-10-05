import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { type ColorValue } from 'react-native';
import { usePalette } from '../../src/ui/palette';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * L'icône d'un onglet : pleine quand il est actif, en trait sinon.
 *
 * La teinte seule ne suffit pas à désigner l'onglet où l'on est : une
 * couleur se perd au soleil, sous un écran baissé, ou pour qui la distingue
 * mal. Une silhouette pleine se voit sans elle.
 */
function tabIcon(filled: IconName, outline: IconName) {
  return ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons name={focused ? filled : outline} size={24} color={color} />
  );
}

/**
 * Les quatre sections de l'application.
 *
 * Elles seules sont des onglets. Tout ce qui s'ouvre PAR-DESSUS -- une fiche,
 * un formulaire, les réglages -- vit dans la pile au-dessus de ce groupe :
 * un écran caché de la barre reste un onglet, et revenir depuis un onglet
 * ramène au premier de la liste, pas à l'écran d'où l'on vient.
 *
 * Un onglet est un endroit où l'on REVIENT sans cesse. L'historique et les
 * objectifs, eux, se consultent : ils sont passés dans la pile, sous le
 * profil, et ce sont de vrais fichiers déplacés hors de ce dossier -- les
 * cacher de la barre les aurait laissés onglets, avec le retour qui ramène
 * au premier de la liste plutôt qu'à l'écran d'où l'on vient.
 *
 * Chaque icône porte son nom. La barre n'en a longtemps porté aucun, et deux
 * pictogrammes -- une liste, une grille -- ne disaient pas lequel menait aux
 * exercices et lequel aux entraînements : un libellé coûte deux points
 * d'icône, deviner coûte un aller-retour.
 */
export default function TabsLayout() {
  // La barre d'onglets est un composant natif : ses couleurs se règlent en
  // JavaScript, la variante `dark:` de NativeWind ne l'atteint pas.
  const palette = usePalette();

  return (
    <Tabs
      screenOptions={{
        // Chaque écran porte son propre en-tête, dessiné par nos composants.
        headerShown: false,
        tabBarActiveTintColor: palette.primaryInk,
        tabBarInactiveTintColor: palette.muted,
        tabBarLabelStyle: { fontFamily: 'Archivo_700Bold', fontSize: 11 },
        tabBarStyle: {
          backgroundColor: palette.surfaceAlt,
          borderTopColor: palette.border,
          paddingTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: 'Accueil', tabBarIcon: tabIcon('home', 'home-outline') }}
      />
      <Tabs.Screen
        name="session"
        options={{ title: 'Séance', tabBarIcon: tabIcon('flash', 'flash-outline') }}
      />
      <Tabs.Screen
        name="index"
        options={{ title: 'Exercices', tabBarIcon: tabIcon('barbell', 'barbell-outline') }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: 'Entraînements',
          tabBarIcon: tabIcon('clipboard', 'clipboard-outline'),
        }}
      />
    </Tabs>
  );
}
