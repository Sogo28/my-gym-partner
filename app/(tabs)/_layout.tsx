import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';

/**
 * Les cinq sections de l'application.
 *
 * Elles seules sont des onglets. Tout ce qui s'ouvre PAR-DESSUS -- une fiche,
 * un formulaire, les réglages -- vit dans la pile au-dessus de ce groupe :
 * un écran caché de la barre reste un onglet, et revenir depuis un onglet
 * ramène au premier de la liste, pas à l'écran d'où l'on vient.
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
        tabBarActiveTintColor: dark ? '#BFF04A' : '#46600F',
        tabBarInactiveTintColor: dark ? '#8B9086' : '#5F6459',
        tabBarStyle: {
          backgroundColor: dark ? '#141613' : '#EDEFE8',
          borderTopColor: dark ? '#2A2D28' : '#DDE0D6',
          paddingTop: 8,
          height: 84,
        },
        tabBarLabelStyle: { fontFamily: 'Archivo_700Bold', fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="session"
        options={{
          title: 'Séance',
          tabBarIcon: ({ color }) => <Ionicons name="barbell-outline" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Historique',
          tabBarIcon: ({ color }) => <Ionicons name="time-outline" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Exercices',
          tabBarIcon: ({ color }) => <Ionicons name="list-outline" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: 'Objectifs',
          tabBarIcon: ({ color }) => <Ionicons name="trophy-outline" size={19} color={color} />,
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: 'Entraîn.',
          tabBarIcon: ({ color }) => <Ionicons name="grid-outline" size={19} color={color} />,
        }}
      />
    </Tabs>
  );
}
