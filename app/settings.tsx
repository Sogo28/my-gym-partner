import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Button } from '../src/ui/button';
import { Card } from '../src/ui/card';
import { useNotifications } from '../src/ui/notifications';
import { messageOf } from '../src/ui/message';
import { Sheet } from '../src/ui/sheet';
import { eraseHistory } from '../src/use-cases/erase-history';
import { resetEverything } from '../src/use-cases/reset-actions';
import type { EvaluationWindow } from '../src/domain/goal/goal';
import { WINDOW_LABELS } from '../src/ui/goal-labels';
import {
  captureCountdown,
  COUNTDOWN_CHOICES,
  emomSetupCountdown,
  evaluationWindow,
  setCaptureCountdown,
  setEmomSetupCountdown,
  setEvaluationWindow,
  SELECTABLE_WINDOWS,
  SETUP_CHOICES,
} from '../src/use-cases/preferences';
import {
  ATTRIBUTION,
  ATTRIBUTION_URL,
  catalogueState,
  downloadCatalogue,
  forgetCatalogue,
  type CatalogueState,
} from '../src/use-cases/repdb-actions';
import { ListContent, ListLayout } from '../src/ui/list-layout';

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
  const { notify } = useNotifications();
  const router = useRouter();
  const [state, setState] = useState<CatalogueState>({ downloaded: false, size: 0 });
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [erasing, setErasing] = useState(false);
  /** La période sur laquelle TOUS les objectifs se jugent. */
  const [window, setWindow] = useState<EvaluationWindow>('LAST_SESSION');
  /** Le décompte avant qu'une captation ne démarre, en secondes. */
  const [countdown, setCountdown] = useState(5);
  const [setup, setSetup] = useState(10);

  useFocusEffect(
    useCallback(() => {
      setState(catalogueState());
      evaluationWindow().then(setWindow).catch((e) => notify(messageOf(e)));
      captureCountdown().then(setCountdown).catch((e) => notify(messageOf(e)));
      emomSetupCountdown().then(setSetup).catch((e) => notify(messageOf(e)));
    }, []),
  );

  function chooseCountdown(next: number) {
    setCountdown(next);
    setCaptureCountdown(next).catch((e) => notify(messageOf(e)));
  }

  function chooseSetup(next: number) {
    setSetup(next);
    setEmomSetupCountdown(next).catch((e) => notify(messageOf(e)));
  }

  function chooseWindow(next: EvaluationWindow) {
    // Affiché tout de suite, écrit ensuite : le choix n'a rien à confirmer,
    // et rien ne dépend de l'écriture pour être juste.
    setWindow(next);
    setEvaluationWindow(next).catch((e) => notify(messageOf(e)));
  }

  async function fetchCatalogue() {
    setBusy(true);
    try {
      setState(await downloadCatalogue());
    } catch (e) {
      notify(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ListLayout title="Réglages" onBack={() => router.back()}>
      <ListContent className="pb-8">

        <Card density="titled" className="gap-2">
          <Text className="font-extrabold text-heading text-ink dark:text-ink-dark">
            Évaluation des objectifs
          </Text>
          <Text className="text-small text-muted dark:text-muted-dark">
            Sur quoi tes objectifs se jugent. Le choix vaut pour TOUS, y compris ceux que tu as
            déjà : le basculer les réévalue tout de suite.
          </Text>

          <View className="flex-row flex-wrap gap-2 pt-1">
            {SELECTABLE_WINDOWS.map((value) => (
              <Pressable
                key={value}
                onPress={() => chooseWindow(value)}
                className={
                  window === value
                    ? 'min-h-touch justify-center rounded-full border border-primary-ink bg-primary-soft px-4 dark:border-primary-ink-dark dark:bg-primary-soft-dark'
                    : 'min-h-touch justify-center rounded-full border border-border bg-surface px-4 dark:border-border-dark dark:bg-surface-dark'
                }
              >
                <Text
                  className={
                    window === value
                      ? 'font-medium text-body text-primary-ink dark:text-primary-ink-dark'
                      : 'font-medium text-body text-muted dark:text-muted-dark'
                  }
                >
                  {WINDOW_LABELS.find((entry) => entry.value === value)?.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card density="titled" className="mt-2 gap-2">
          <Text className="font-extrabold text-heading text-ink dark:text-ink-dark">
            Catalogue d exercices
          </Text>
          <Text className="text-small text-muted dark:text-muted-dark">
            601 exercices avec leurs muscles, pour remplir un nouvel exercice sans tout saisir. Le
            fichier est copié sur ce téléphone : une fois téléchargé, il fonctionne sans réseau.
          </Text>

          <Text className="font-mono text-small text-muted dark:text-muted-dark">
            {state.downloaded ? `Téléchargé · ${formatSize(state.size)}` : 'Pas encore téléchargé'}
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
            <Text className="pt-1 text-small text-primary-ink dark:text-primary-ink-dark">
              {ATTRIBUTION}
            </Text>
          </Pressable>
        </Card>

        <Text className="px-1 text-small text-muted dark:text-muted-dark">
          Tes sauvegardes ne contiennent pas ce catalogue : il se retélécharge d'un bouton, et
          l'alourdir n'aurait servi personne.
        </Text>

        <Card density="titled" className="mt-2 gap-2">
          <Text className="font-extrabold text-heading text-ink dark:text-ink-dark">
            Filmer une série
          </Text>
          <Text className="text-small text-muted dark:text-muted-dark">
            Le temps dont tu disposes, entre le départ et le début de l'enregistrement, pour poser
            le téléphone et rejoindre la barre. L'enregistrement s'arrête seul au bout de deux
            minutes.
          </Text>

          <View className="flex-row flex-wrap gap-2 pt-1">
            {COUNTDOWN_CHOICES.map((value) => (
              <Pressable
                key={value}
                onPress={() => chooseCountdown(value)}
                className={
                  countdown === value
                    ? 'min-h-touch justify-center rounded-full border border-primary-ink bg-primary-soft px-4 dark:border-primary-ink-dark dark:bg-primary-soft-dark'
                    : 'min-h-touch justify-center rounded-full border border-border bg-surface px-4 dark:border-border-dark dark:bg-surface-dark'
                }
              >
                <Text
                  className={
                    countdown === value
                      ? 'font-medium text-body text-primary-ink dark:text-primary-ink-dark'
                      : 'font-medium text-body text-muted dark:text-muted-dark'
                  }
                >
                  {value === 0 ? 'Immédiat' : `${value} s`}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card density="titled" className="mt-2 gap-2">
          <Text className="font-extrabold text-heading text-ink dark:text-ink-dark">
            Se mettre en place
          </Text>
          <Text className="text-small text-muted dark:text-muted-dark">
            Le temps que l'EMOM te laisse, après l'avoir démarré, avant que le premier round ne
            parte : de quoi poser le téléphone et te mettre en position. Les rounds suivants
            s'enchaînent sans délai, puisque tu y es déjà.
          </Text>

          <View className="flex-row flex-wrap gap-2 pt-1">
            {SETUP_CHOICES.map((value) => (
              <Pressable
                key={value}
                onPress={() => chooseSetup(value)}
                className={
                  setup === value
                    ? 'min-h-touch justify-center rounded-full border border-primary-ink bg-primary-soft px-4 dark:border-primary-ink-dark dark:bg-primary-soft-dark'
                    : 'min-h-touch justify-center rounded-full border border-border bg-surface px-4 dark:border-border-dark dark:bg-surface-dark'
                }
              >
                <Text
                  className={
                    setup === value
                      ? 'font-medium text-body text-primary-ink dark:text-primary-ink-dark'
                      : 'font-medium text-body text-muted dark:text-muted-dark'
                  }
                >
                  {value === 0 ? 'Immédiat' : `${value} s`}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card density="titled" className="mt-2 gap-2">
          <Text className="font-extrabold text-heading text-ink dark:text-ink-dark">
            Historique
          </Text>
          <Text className="text-small text-muted dark:text-muted-dark">
            Efface tes séances passées et tout ce qu elles ont produit. Tes exercices,
            entraînements, objectifs et relevés restent : ce sont tes outils, pas ton historique.
          </Text>
          <Text className="text-small text-muted dark:text-muted-dark">
            Tes objectifs gardent l étape où ils en sont -- tu l as franchie --, mais n auront plus
            de performances à évaluer.
          </Text>
          <Button
            label="Effacer l'historique"
            variant="danger"
            size="md"
            onPress={() => setErasing(true)}
          />
        </Card>

        <Card density="titled" className="mt-2 gap-2">
          <Text className="font-extrabold text-heading text-ink dark:text-ink-dark">
            Repartir de zéro
          </Text>
          <Text className="text-small text-muted dark:text-muted-dark">
            Efface tes exercices, entraînements, séances, objectifs et relevés. Les mesures, les
            muscles et les mensurations de départ restent : ce sont le vocabulaire de
            l application, pas tes données.
          </Text>
          <Text className="text-small text-muted dark:text-muted-dark">
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
      </ListContent>

      <Sheet
        visible={erasing}
        title="Effacer l'historique ?"
        description="Toutes tes séances passées disparaissent définitivement, avec les performances qu'elles portaient. Une sauvegarde est le seul moyen de les retrouver."
        actions={[
          {
            label: "Effacer l'historique",
            tone: 'danger',
            onPress: () =>
              eraseHistory()
                .then(() => notify('Historique effacé.', 'success'))
                .catch((e) => notify(messageOf(e))),
          },
        ]}
        onClose={() => setErasing(false)}
      />

      <Sheet
        visible={resetting}
        title="Tout effacer ?"
        description="Tes exercices, séances et objectifs disparaissent définitivement. Une sauvegarde est le seul moyen de les retrouver."
        actions={[
          {
            label: 'Tout effacer',
            tone: 'danger',
            onPress: () =>
              resetEverything().catch((e) => notify(messageOf(e))),
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
    </ListLayout>
  );
}
