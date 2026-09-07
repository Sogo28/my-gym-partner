import { Archivo_400Regular } from '@expo-google-fonts/archivo/400Regular';
import { Archivo_500Medium } from '@expo-google-fonts/archivo/500Medium';
import { Archivo_700Bold } from '@expo-google-fonts/archivo/700Bold';
import { Archivo_800ExtraBold } from '@expo-google-fonts/archivo/800ExtraBold';
import { Archivo_900Black } from '@expo-google-fonts/archivo/900Black';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono/400Regular';
import { JetBrainsMono_800ExtraBold } from '@expo-google-fonts/jetbrains-mono/800ExtraBold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
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

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Les onglets, et par-dessus eux les écrans qu'on ouvre puis referme.
          Chacun se pose SUR la barre au lieu de la remplacer : le retour
          rend la main à l'onglet d'où l'on vient, et non au premier. */}
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="exercise" />
      <Stack.Screen name="new-exercise" />
      <Stack.Screen name="new-goal" />
      <Stack.Screen name="body" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
