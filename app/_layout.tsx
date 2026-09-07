import { Archivo_400Regular } from '@expo-google-fonts/archivo/400Regular';
import { Archivo_500Medium } from '@expo-google-fonts/archivo/500Medium';
import { Archivo_700Bold } from '@expo-google-fonts/archivo/700Bold';
import { Archivo_800ExtraBold } from '@expo-google-fonts/archivo/800ExtraBold';
import { Archivo_900Black } from '@expo-google-fonts/archivo/900Black';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono/400Regular';
import { JetBrainsMono_800ExtraBold } from '@expo-google-fonts/jetbrains-mono/800ExtraBold';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
// Charge les styles Tailwind générés. Doit être importé une seule fois, ici.
import '../global.css';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // La couleur se règle en JavaScript : la variante `dark:` de NativeWind
  // n'atteint pas les composants du navigateur.
  const dark = useColorScheme() === 'dark';

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

  /**
   * Le thème du NAVIGATEUR, distinct de celui de nos écrans.
   *
   * Chaque navigateur peint un fond sous l'écran qu'il affiche, et le thème
   * par défaut de react-navigation est clair : d'où l'éclair blanc entre deux
   * écrans, que déclarer le fond d'une pile ne suffisait pas à couvrir --
   * les onglets ont le leur, et la racine de l'application aussi.
   */
  const theme = dark
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: '#0E0F0D', card: '#141613' } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: '#F6F7F3', card: '#EDEFE8' } };

  return (
    <ThemeProvider value={theme}>
    <Stack
      screenOptions={{
        headerShown: false,
        // Le fond de la PILE, pas celui de l'écran : pendant une transition,
        // le navigateur peint sa propre carte, et sa couleur par défaut est
        // le blanc -- d'où l'éclair blanc en ouvrant une fiche ou en revenant.
        contentStyle: { backgroundColor: dark ? '#0E0F0D' : '#F6F7F3' },
      }}
    >
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
    </ThemeProvider>
  );
}
