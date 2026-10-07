import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
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
  captureLimit,
  CAPTURE_LIMIT_CHOICES,
  BEFORE_SET_CHOICES,
  COUNTDOWN_CHOICES,
  countdownBeforeSet,
  emomSetupCountdown,
  REST_EVERY_CHOICES,
  REST_SIGNAL_CHOICES,
  restSignal,
  restSignalEvery,
  setCountdownBeforeSet,
  setRestSignal,
  setRestSignalEvery,
  type RestSignal,
  evaluationWindow,
  setCaptureCountdown,
  setCaptureLimit,
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
import { MetaLine } from '../src/ui/meta-line';
import { usePalette } from '../src/ui/palette';
import { Segmented } from '../src/ui/segmented';

const REST_SIGNAL_LABELS: Record<RestSignal, string> = {
  none: 'Aucun',
  vibration: 'Vibration',
  sound: 'Son + vibration',
};

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
  /** La durée maximale d'une vidéo, en secondes ; zéro, aucune. */
  const [limit, setLimit] = useState(0);
  const [beforeSet, setBeforeSet] = useState(3);
  const [signal, setSignal] = useState<RestSignal>('vibration');
  const [every, setEvery] = useState(60);

  useFocusEffect(
    useCallback(() => {
      setState(catalogueState());
      evaluationWindow().then(setWindow).catch((e) => notify(messageOf(e)));
      captureCountdown().then(setCountdown).catch((e) => notify(messageOf(e)));
      emomSetupCountdown().then(setSetup).catch((e) => notify(messageOf(e)));
      captureLimit().then(setLimit).catch((e) => notify(messageOf(e)));
      countdownBeforeSet().then(setBeforeSet).catch((e) => notify(messageOf(e)));
      restSignal().then(setSignal).catch((e) => notify(messageOf(e)));
      restSignalEvery().then(setEvery).catch((e) => notify(messageOf(e)));
    }, []),
  );

  function chooseCountdown(next: number) {
    setCountdown(next);
    setCaptureCountdown(next).catch((e) => notify(messageOf(e)));
  }

  function chooseLimit(next: number) {
    setLimit(next);
    setCaptureLimit(next).catch((e) => notify(messageOf(e)));
  }

  function chooseBeforeSet(next: number) {
    setBeforeSet(next);
    setCountdownBeforeSet(next).catch((e) => notify(messageOf(e)));
  }

  function chooseSignal(next: RestSignal) {
    setSignal(next);
    setRestSignal(next).catch((e) => notify(messageOf(e)));
  }

  function chooseEvery(next: number) {
    setEvery(next);
    setRestSignalEvery(next).catch((e) => notify(messageOf(e)));
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

  const seconds = (value: number) => (value === 0 ? 'Immédiat' : `${value} s`);

  return (
    <ListLayout title="Réglages" onBack={() => router.back()}>
      <ListContent className="gap-6 pb-8">
        <Section title="Objectifs">
          <Setting
            icon="trophy-outline"
            title="Évaluation"
            description="Sur quoi tes objectifs se jugent. Le changer réévalue aussitôt tous tes objectifs, y compris ceux en cours."
          >
            <Segmented
              segments={SELECTABLE_WINDOWS.map((value) => ({
                value,
                label: WINDOW_LABELS.find((entry) => entry.value === value)?.label ?? value,
              }))}
              value={window}
              onChange={chooseWindow}
            />
          </Setting>
        </Section>

        <Section title="Séance">
          <Setting
            icon="play-outline"
            title="Décompte avant une série"
            description="Après « Démarrer », le temps de te mettre en place. La série ne commence qu'à zéro."
          >
            <Segmented
              segments={BEFORE_SET_CHOICES.map((value) => ({ value, label: seconds(value) }))}
              value={beforeSet}
              onChange={chooseBeforeSet}
            />
          </Setting>

          <Setting
            icon="notifications-outline"
            title="Signal pendant le repos"
            description="À chaque tour de l'anneau du repos, pour savoir depuis combien de temps tu souffles sans regarder l'écran."
          >
            <Segmented
              segments={REST_SIGNAL_CHOICES.map((value) => ({
                value,
                label: REST_SIGNAL_LABELS[value],
              }))}
              value={signal}
              onChange={chooseSignal}
            />
            {signal !== 'none' && (
              <View className="gap-1.5">
                <Text className="text-small text-muted dark:text-muted-dark">Toutes les</Text>
              <Segmented
                segments={REST_EVERY_CHOICES.map((value) => ({
                  value,
                  label: value < 60 ? `${value} s` : `${value / 60} min`,
                }))}
                value={every}
                onChange={chooseEvery}
              />
              </View>
            )}
          </Setting>

          <Setting
            icon="videocam-outline"
            title="Filmer une série"
            description="Le temps pour poser le téléphone et te mettre en place avant que l'enregistrement démarre."
          >
            <Segmented
              segments={COUNTDOWN_CHOICES.map((value) => ({ value, label: seconds(value) }))}
              value={countdown}
              onChange={chooseCountdown}
            />
          </Setting>

          <Setting
            icon="stopwatch-outline"
            title="Durée maximale d'une vidéo"
            description="Au-delà, l'enregistrement s'arrête seul, après cinq bips. Sans limite, il ne s'arrête que quand tu le coupes."
          >
            <Segmented
              segments={CAPTURE_LIMIT_CHOICES.map((value) => ({
                value,
                label: value === 0 ? 'Aucune' : `${value / 60} min`,
              }))}
              value={limit}
              onChange={chooseLimit}
            />
          </Setting>

          <Setting
            icon="timer-outline"
            title="Mise en place d'un EMOM"
            description="Le temps avant le premier round, pour te mettre en position. Les rounds suivants s'enchaînent sans délai."
          >
            <Segmented
              segments={SETUP_CHOICES.map((value) => ({ value, label: seconds(value) }))}
              value={setup}
              onChange={chooseSetup}
            />
          </Setting>
        </Section>

        <Section title="Catalogue d'exercices">
          <Setting
            icon="library-outline"
            title="601 exercices avec leurs muscles"
            description="Pour remplir un nouvel exercice sans tout saisir. Une fois téléchargé, il fonctionne sans réseau. Tes sauvegardes ne le contiennent pas : il se retélécharge d'un bouton."
          >
            <MetaLine
              items={[
                state.downloaded
                  ? { icon: 'checkmark-circle-outline', label: `Téléchargé · ${formatSize(state.size)}`, tone: 'done' }
                  : { icon: 'cloud-download-outline', label: 'Pas encore téléchargé' },
              ]}
            />
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
            <Pressable
              onPress={() => Linking.openURL(ATTRIBUTION_URL).catch(() => {})}
              className="active:opacity-50"
            >
              <Text className="text-small text-muted underline dark:text-muted-dark">
                {ATTRIBUTION}
              </Text>
            </Pressable>
          </Setting>
        </Section>

        {/* Ce qui ne se défait pas, à part et en dernier. */}
        <Section title="Données">
          <Setting
            icon="time-outline"
            tone="danger"
            title="Effacer l'historique"
            description="Tes séances passées et leurs performances disparaissent. Exercices, entraînements, objectifs et relevés restent ; tes objectifs gardent l'étape où ils en sont."
          >
            <Button
              label="Effacer l'historique"
              variant="danger"
              size="md"
              onPress={() => setErasing(true)}
            />
          </Setting>

          <Setting
            icon="refresh-outline"
            tone="danger"
            title="Repartir de zéro"
            description="Tout ce que tu as saisi disparaît ; seuls restent les mesures, les muscles et les mensurations de départ. Fais une sauvegarde d'abord : rien d'autre ne permettra de revenir en arrière."
          >
            <Button
              label="Tout effacer"
              variant="danger"
              size="md"
              onPress={() => setResetting(true)}
            />
          </Setting>
        </Section>
      </ListContent>

      <Sheet
        visible={erasing}
        title="Effacer l'historique ?"
        description="Toutes tes séances passées disparaissent définitivement, avec les performances qu'elles portaient. Une sauvegarde est le seul moyen de les retrouver."
        actions={[
          {
            label: "Effacer l'historique",
            icon: 'trash-outline',
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
            icon: 'trash-outline',
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
            icon: 'trash-outline',
            tone: 'danger',
            onPress: () => setState(forgetCatalogue()),
          },
        ]}
        onClose={() => setConfirming(false)}
      />
    </ListLayout>
  );
}

/** Une section de la page : son titre en capitales, puis ses réglages. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="px-1 font-bold uppercase text-label text-muted dark:text-muted-dark">
        {title}
      </Text>
      {children}
    </View>
  );
}

/**
 * Un réglage : une icône qui dit de quoi il s'agit, un titre, une phrase
 * qui dit ce que le choix change, puis le choix lui-même. Une action qui ne
 * se défait pas porte son icône en rouge.
 */
function Setting({
  icon,
  title,
  description,
  tone = 'default',
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  tone?: 'default' | 'danger';
  children: ReactNode;
}) {
  const { ink, danger } = usePalette();

  return (
    <Card density="titled" className="gap-3">
      <View className="flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-lg bg-surface-alt dark:bg-surface-alt-dark">
          <Ionicons name={icon} size={18} color={tone === 'danger' ? danger : ink} />
        </View>
        <Text className="shrink font-extrabold text-body text-ink dark:text-ink-dark">{title}</Text>
      </View>
      <Text className="text-small text-muted dark:text-muted-dark">{description}</Text>
      {children}
    </Card>
  );
}
