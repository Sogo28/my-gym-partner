import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
    <Ionicons name={focused ? filled : outline} size={21} color={color} />
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
 * La barre ne porte que des icônes, et des icônes qui ressemblent à ce
 * qu'elles ouvrent : un éclair pour la séance, une barre pour les exercices,
 * un bloc-notes pour les entraînements. Une liste et une grille, elles, ne
 * disaient pas lequel était lequel -- c'est ce qui avait fait ajouter des
 * libellés, retirés depuis : quatre destinations visitées chaque jour n'ont
 * pas besoin d'être nommées à chaque fois.
 *
 * Le nom reste dit à voix haute (`tabBarAccessibilityLabel`) : une icône
 * seule ne se lit pas, et le repli sur `title` ne vaut que pour iOS.
 */
export default function TabsLayout() {
  // La barre d'onglets est un composant natif : ses couleurs se règlent en
  // JavaScript, la variante `dark:` de NativeWind ne l'atteint pas.
  const palette = usePalette();
  // La barre de gestes d'Android -- le trait qui ramène à l'accueil du
  // téléphone -- occupe le bas de l'écran : la barre d'onglets se pose
  // AU-DESSUS, avec sa propre marge, au lieu de coller ses libellés dessus.
  const { bottom } = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        // Chaque écran porte son propre en-tête, dessiné par nos composants.
        headerShown: false,
        tabBarActiveTintColor: palette.primaryInk,
        tabBarInactiveTintColor: palette.muted,
        tabBarShowLabel: false,
        // Une hauteur FIXE et des marges égales en haut et en bas, la barre
        // de gestes ajoutée dessous : l'icône tombe au milieu de la barre.
        tabBarStyle: {
          backgroundColor: palette.surfaceAlt,
          borderTopColor: palette.border,
          height: 52 + bottom,
          paddingTop: 8,
          paddingBottom: 8 + bottom,
        },
        // Un onglet empile son icône PUIS son libellé, alignés en haut : le
        // libellé retiré, l'icône resterait collée au plafond. Deux marges
        // automatiques lui font absorber le vide des deux côtés -- seul
        // endroit d'où recentrer, l'alignement vivant dans un style interne
        // que nulle option n'expose.
        tabBarIconStyle: { marginVertical: 'auto' },
      }}
    >
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
          tabBarIcon: tabIcon('flash', 'flash-outline'),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Exercices',
          tabBarAccessibilityLabel: 'Exercices',
          tabBarIcon: tabIcon('barbell', 'barbell-outline'),
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: 'Entraînements',
          tabBarAccessibilityLabel: 'Entraînements',
          tabBarIcon: tabIcon('clipboard', 'clipboard-outline'),
        }}
      />
    </Tabs>
  );
}
