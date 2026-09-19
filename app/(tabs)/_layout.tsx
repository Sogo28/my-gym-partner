import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useColorScheme, type ColorValue } from 'react-native';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * L'icône d'un onglet : pleine quand il est actif, en trait sinon.
 *
 * Sans libellé, la teinte reste seule à désigner l'onglet où l'on est, et
 * elle ne suffit pas : une couleur se perd au soleil, sous un écran baissé,
 * ou pour qui la distingue mal. Une silhouette pleine se voit sans elle.
 */
function tabIcon(filled: IconName, outline: IconName) {
  return ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons name={focused ? filled : outline} size={26} color={color} />
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
 * La barre ne porte que des icônes. Quatre destinations qu'on visite chaque
 * jour n'ont pas besoin qu'on les nomme à chaque fois, et le libellé coûtait
 * la taille de l'icône -- c'est-à-dire la lisibilité de la seule chose qui
 * reste à viser du pouce, une main occupée par une barre.
 */
export default function TabsLayout() {
  // La barre d'onglets est un composant natif : ses couleurs se règlent en
  // JavaScript, la variante `dark:` de NativeWind ne l'atteint pas.
  const dark = useColorScheme() === 'dark';

  return (
    <Tabs
      screenOptions={{
        // Chaque écran porte son propre en-tête, dessiné par nos composants.
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: dark ? '#BFF04A' : '#46600F',
        tabBarInactiveTintColor: dark ? '#8B9086' : '#5F6459',
        tabBarStyle: {
          backgroundColor: dark ? '#141613' : '#EDEFE8',
          borderTopColor: dark ? '#2A2D28' : '#DDE0D6',
          // Plus de rembourrage haut : il compensait le libellé posé sous
          // l'icône. Seule, elle se centre dans la hauteur qui reste -- dont
          // la barre retranche d'elle-même la marge du bas de l'écran.
          height: 84,
        },
      }}
    >
      {/* `title` n'est plus affiché nulle part, mais reste le nom que les
          lecteurs d'écran annoncent : une icône seule ne se lit pas à voix
          haute, et `tabBarAccessibilityLabel` le dit sur les deux
          plateformes, là où le repli automatique ne vaut que pour iOS. */}
      <Tabs.Screen
        name="home"
        options={{
          title: 'Accueil',
          tabBarAccessibilityLabel: 'Accueil',
          tabBarIcon: tabIcon('home', 'home-outline'),
        }}
      />
      <Tabs.Screen
        name="session"
        options={{
          title: 'Séance',
          tabBarAccessibilityLabel: 'Séance',
          tabBarIcon: tabIcon('barbell', 'barbell-outline'),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Exercices',
          tabBarAccessibilityLabel: 'Exercices',
          tabBarIcon: tabIcon('list', 'list-outline'),
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: 'Entraînements',
          tabBarAccessibilityLabel: 'Entraînements',
          tabBarIcon: tabIcon('grid', 'grid-outline'),
        }}
      />
    </Tabs>
  );
}
