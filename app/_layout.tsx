import { Archivo_400Regular } from '@expo-google-fonts/archivo/400Regular';
import { Archivo_500Medium } from '@expo-google-fonts/archivo/500Medium';
import { Archivo_700Bold } from '@expo-google-fonts/archivo/700Bold';
import { Archivo_800ExtraBold } from '@expo-google-fonts/archivo/800ExtraBold';
import { Archivo_900Black } from '@expo-google-fonts/archivo/900Black';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono/400Regular';
import { JetBrainsMono_800ExtraBold } from '@expo-google-fonts/jetbrains-mono/800ExtraBold';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Tabs } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
// Charge les styles Tailwind générés. Doit être importé une seule fois, ici.
import '../global.css';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // React Native ne synthétise pas le gras : chaque graisse est un fichier.
  const [fontsLoaded] = useFonts({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_700Bold,
    Archivo_800ExtraBold,
    Archivo_900Black,
    JetBrainsMono_400Regular,
    JetBrainsMono_800ExtraBold,
  });

  // La barre d'onglets est un composant natif : ses couleurs se règlent en
  // JavaScript, la variante `dark:` de NativeWind ne l'atteint pas.
  const dark = useColorScheme() === 'dark';

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

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
      {/* href: null garde l'écran hors de la barre d'onglets : on y arrive
          depuis la liste des exercices, ce n'est pas une section. */}
      <Tabs.Screen name="new-exercise" options={{ href: null }} />
      <Tabs.Screen name="new-goal" options={{ href: null }} />
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
