import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../src/ui/button';
import { Card } from '../src/ui/card';
import { messageOf } from '../src/ui/message';
import { BusinessNotice } from '../src/ui/notice';
import { BackHeader } from '../src/ui/screen-header';
import { Sheet } from '../src/ui/sheet';
import { resetEverything } from '../src/use-cases/reset-actions';
import {
  ATTRIBUTION,
  ATTRIBUTION_URL,
  catalogueState,
  downloadCatalogue,
  forgetCatalogue,
  type CatalogueState,
} from '../src/use-cases/repdb-actions';

/** « 2,1 Mo » : la taille se lit, elle ne se compte pas en octets. */
function formatSize(bytes: number): string {
  return `${Math.round((bytes / 1_000_000) * 10) / 10} Mo`;
}

/**
 * Les réglages : ce qui touche à l'application plutôt qu'à l'entraînement.
 *
 * Pour l'instant, le catalogue d'exercices tiers -- une copie locale, comme
 * tout le reste ici : téléchargée une fois, consultable sans réseau, et
 * effaçable quand elle ne sert plus.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const [state, setState] = useState<CatalogueState>({ downloaded: false, size: 0 });
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setState(catalogueState());
    }, []),
  );

  async function fetchCatalogue() {
    setBusy(true);
    try {
      setState(await downloadCatalogue());
      setError(null);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-5 pt-4">
        <BackHeader title="Réglages" onBack={() => router.back()} />
      </View>

      <ScrollView contentContainerClassName="gap-3 px-5 pb-8">
        {error && <BusinessNotice message={error} />}

        <Card density="titled" className="gap-2">
          <Text className="font-extrabold text-heading text-ink dark:text-ink-dark">
            Catalogue d exercices
          </Text>
          <Text className="text-[13px] text-muted dark:text-muted-dark">
            601 exercices avec leurs muscles, pour remplir un nouvel exercice sans tout saisir. Le
            fichier est copié sur ce téléphone : une fois téléchargé, il fonctionne sans réseau.
          </Text>

          <Text className="font-mono text-[12px] text-muted dark:text-muted-dark">
            {state.downloaded ? `téléchargé · ${formatSize(state.size)}` : 'pas encore téléchargé'}
          </Text>

          <Button
            label={busy ? 'Téléchargement…' : state.downloaded ? 'Mettre à jour' : 'Télécharger'}
            size="md"
            disabled={busy}
            onPress={fetchCatalogue}
          />
          {state.downloaded && (
            <Button
              label="Effacer le catalogue"
              variant="danger"
              size="md"
              onPress={() => setConfirming(true)}
            />
          )}

          {/* L'attribution que sa licence exige, là où le catalogue sert. */}
          <Pressable onPress={() => Linking.openURL(ATTRIBUTION_URL).catch(() => {})}>
            <Text className="pt-1 text-[12px] text-primary-ink dark:text-primary-ink-dark">
              {ATTRIBUTION}
            </Text>
          </Pressable>
        </Card>

        <Text className="px-1 text-[12px] text-muted dark:text-muted-dark">
          Tes sauvegardes ne contiennent pas ce catalogue : il se retélécharge d un bouton, et
          l alourdir n aurait servi personne.
        </Text>

        <Card density="titled" className="mt-2 gap-2">
          <Text className="font-extrabold text-heading text-ink dark:text-ink-dark">
            Repartir de zéro
          </Text>
          <Text className="text-[13px] text-muted dark:text-muted-dark">
            Efface tes exercices, entraînements, séances, objectifs et relevés. Les mesures, les
            muscles et les mensurations de départ restent : ce sont le vocabulaire de
            l application, pas tes données.
          </Text>
          <Text className="text-[13px] text-muted dark:text-muted-dark">
            Fais une sauvegarde d abord si tu veux pouvoir revenir en arrière : rien d autre ne le
            permettra.
          </Text>
          <Button
            label="Tout effacer"
            variant="danger"
            size="md"
            onPress={() => setResetting(true)}
          />
        </Card>
      </ScrollView>

      <Sheet
        visible={resetting}
        title="Tout effacer ?"
        description="Tes exercices, séances et objectifs disparaissent définitivement. Une sauvegarde est le seul moyen de les retrouver."
        actions={[
          {
            label: 'Tout effacer',
            tone: 'danger',
            onPress: () =>
              resetEverything()
                .then(() => setError(null))
                .catch((e) => setError(messageOf(e))),
          },
        ]}
        onClose={() => setResetting(false)}
      />

      <Sheet
        visible={confirming}
        title="Effacer le catalogue ?"
        description="Les exercices que tu en as tirés restent : ils sont à toi une fois créés."
        actions={[
          {
            label: 'Effacer',
            tone: 'danger',
            onPress: () => setState(forgetCatalogue()),
          },
        ]}
        onClose={() => setConfirming(false)}
      />
    </SafeAreaView>
  );
}
