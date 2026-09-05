import { Archivo_400Regular } from '@expo-google-fonts/archivo/400Regular';
import { Archivo_500Medium } from '@expo-google-fonts/archivo/500Medium';
import { Archivo_700Bold } from '@expo-google-fonts/archivo/700Bold';
import { Archivo_800ExtraBold } from '@expo-google-fonts/archivo/800ExtraBold';
import { Archivo_900Black } from '@expo-google-fonts/archivo/900Black';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono/400Regular';
import { JetBrainsMono_800ExtraBold } from '@expo-google-fonts/jetbrains-mono/800ExtraBold';
import { useFonts } from 'expo-font';
import { Tabs } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
// Charge les styles Tailwind générés. Doit être importé une seule fois, ici.
import '../global.css';

// L'écran de démarrage reste affiché tant que les polices ne sont pas prêtes :
// sinon l'app apparaît une fraction de seconde dans la police système, puis
// se redessine.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // React Native ne synthétise pas le gras : chaque graisse est un fichier à
  // charger et à nommer, et c'est ce nom qu'on utilise dans font-*.
  const [fontsLoaded] = useFonts({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_700Bold,
    Archivo_800ExtraBold,
    Archivo_900Black,
    JetBrainsMono_400Regular,
    JetBrainsMono_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#46600F' }}>
      <Tabs.Screen name="session" options={{ title: 'Séance' }} />
      <Tabs.Screen name="index" options={{ title: 'Exercices' }} />
      <Tabs.Screen name="workouts" options={{ title: 'Entraînements', headerShown: false }} />
      <Tabs.Screen name="history" options={{ title: 'Historique' }} />
    </Tabs>
  );
}
