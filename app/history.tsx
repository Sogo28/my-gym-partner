import { useFocusEffect, useRouter } from 'expo-router';
import { useNotifications } from '../src/ui/notifications';
import { messageOf } from '../src/ui/message';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Exercise } from '../src/domain/exercise/exercise';
import type { PlannedWorkout } from '../src/domain/planned-workout/planned-workout';
import { findAll as findAllExercises } from '../src/infra/exercise-repository';
import { findAll as findAllPlans } from '../src/infra/planned-workout-repository';
import { listSessionSummaries, type SessionSummary } from '../src/use-cases/session-summary';
import {
  applyBackup,
  pickBackup,
  shareBackup,
  type BackupPreview,
} from '../src/use-cases/backup-actions';
import { Button } from '../src/ui/button';
import { Card } from '../src/ui/card';
import { Fab } from '../src/ui/fab';
import { Sheet } from '../src/ui/sheet';
import { EmptyState } from '../src/ui/empty-state';
import { BackHeader } from '../src/ui/screen-header';
import { SearchField } from '../src/ui/search';
import { fold } from '../src/text';
import { formatClock, formatDateTime } from '../src/ui/format';

/** Par pages de dix : de quoi remonter deux semaines d'un coup, pas trois mois. */
const PAGE = 10;

const PERIODS: { label: string; days: number | null }[] = [
  { label: '30 jours', days: 30 },
  { label: '3 mois', days: 90 },
  { label: 'Tout', days: null },
];

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'en cours',
  COMPLETED: 'terminée',
  CANCELLED: 'annulée',
};

export default function HistoryScreen() {
  const { notify } = useNotifications();
  const router = useRouter();
  const [summaries, setSummaries] = useState<SessionSummary[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [plans, setPlans] = useState<PlannedWorkout[]>([]);
  /** La sauvegarde choisie, en attente de confirmation. */
  const [restoring, setRestoring] = useState<BackupPreview | null>(null);
  /** La période affichée, en jours. Null : tout l'historique. */
  const [period, setPeriod] = useState<number | null>(90);
  /** Combien de séances on montre ; le reste attend « afficher plus ». */
  const [shown, setShown] = useState(PAGE);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    // Le résumé est calculé par le use case : l'écran ne fait plus que
    // l'afficher.
    const [allSummaries, allExercises, allPlans] = await Promise.all([
      listSessionSummaries(),
      findAllExercises(),
      findAllPlans(),
    ]);

    setSummaries(allSummaries);
    setExercises(allExercises);
    setPlans(allPlans);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => notify(messageOf(e)));
    }, [load]),
  );

  const nameOf = (id: string) => exercises.find((e) => e.id === id)?.name ?? id;

  const thisMonth = summaries.filter(
    ({ session }) =>
      session.startedAt.getMonth() === new Date().getMonth() &&
      session.startedAt.getFullYear() === new Date().getFullYear(),
  ).length;

  async function backup() {
    setBusy(true);
    try {
      await shareBackup();
    } catch (e) {
      notify(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  async function choose() {
    try {
      setRestoring(await pickBackup());
    } catch (e) {
      notify(messageOf(e));
    }
  }

  async function restore() {
    if (!restoring) return;
    const chosen = restoring;
    setRestoring(null);
    try {
      await applyBackup(chosen.backup);
      await load();
    } catch (e) {
      notify(messageOf(e));
    }
  }

  // Le filtre porte sur la date de DÉBUT : c'est elle qui situe la séance,
  // même pour une séance à cheval sur deux jours.
  const since = period === null ? null : new Date(Date.now() - period * 86_400_000);
  const inPeriod = summaries.filter(
    ({ session }) => since === null || session.startedAt >= since,
  );
  /**
   * La recherche lit le nom de l'entraînement ET celui de ses exercices : on
   * se souvient plus souvent d'avoir fait des dips que du programme qui les
   * contenait.
   */
  const matching = inPeriod.filter(({ session, activities }) => {
    const needle = fold(query.trim());
    if (needle === '') return true;
    const plan = plans.find((candidate) => candidate.id === session.plannedWorkoutId);
    return (
      fold(plan?.name ?? 'Séance libre').includes(needle) ||
      activities.some((activity) => fold(nameOf(activity.exerciseId)).includes(needle))
    );
  });

  const visible = matching.slice(0, shown);

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background dark:bg-background-dark">
      <View className="gap-3 px-5 pt-4">
        <BackHeader
          title="Historique"
          subtitle={`${summaries.length} séance${summaries.length > 1 ? 's' : ''} · ${thisMonth} ce mois-ci`}
          onBack={() => router.back()}
          onMenu={() => setMenu(true)}
        />

        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Chercher une séance ou un exercice"
        />

        <View className="flex-row gap-2 pb-3">
          {PERIODS.map(({ label, days }) => {
            const on = days === period;
            return (
              <Pressable
                key={label}
                onPress={() => {
                  setPeriod(days);
                  // Changer de période repart du début : garder « 40 affichées »
                  // d'une période à l'autre n'a aucun sens.
                  setShown(PAGE);
                }}
                className={
                  on
                    ? 'h-10 justify-center rounded-full bg-primary px-4'
                    : 'h-10 justify-center rounded-full border border-border bg-surface px-4 dark:border-border-dark dark:bg-surface-dark'
                }
              >
                <Text
                  className={
                    on
                      ? 'font-bold text-small text-ink'
                      : 'text-small text-muted dark:text-muted-dark'
                  }
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* La pastille est posée DANS la zone qui défile : son `bottom-6` se
          compte alors depuis le haut de la barre du bas, sans hauteur à
          deviner. La liste défile dessous, son rembourrage bas lui laisse de
          quoi finir sans être recouverte. */}
      <View className="flex-1">
        <ScrollView
          contentContainerClassName="grow gap-3 px-5 pb-28"
          keyboardShouldPersistTaps="handled"
        >
          {summaries.length === 0 && (
            <EmptyState
              title="Aucun historique"
              description="Tes séances terminées apparaîtront ici. Tu peux aussi enregistrer une séance déjà faite, avec le bouton en bas."
            />
          )}

          {summaries.length > 0 && matching.length === 0 && (
            <EmptyState
              title="Rien sur cette période"
              description="Élargis la période pour retrouver tes séances plus anciennes."
            />
          )}

          {visible.map(({ session, duration, restTotal, completedSetCount, activities }, position) => {
            const plan = plans.find((p) => p.id === session.plannedWorkoutId);
            const date = session.startedAt;

            // Une carte, trois chiffres, et le détail derrière un tap. Déplier
            // chaque séance ICI faisait de l'historique une liste de pages
            // empilées, alors qu'on y vient pour RETROUVER une séance -- la
            // lire est le travail de sa fiche.
            return (
              <Pressable
                key={session.id}
                onPress={() =>
                  router.push({ pathname: '/session-summary', params: { id: session.id } })
                }
              >
                <Card density="titled" className="gap-2">
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="shrink">
                      <Text
                        className="font-extrabold text-body text-ink dark:text-ink-dark"
                        numberOfLines={1}
                      >
                        {plan ? plan.name : 'Séance libre'}
                      </Text>
                      <Text className="font-mono text-caption text-muted dark:text-muted-dark">
                        {formatDateTime(date)}
                      </Text>
                    </View>
                    <StatusPill status={session.status} />
                  </View>

                  <View className="flex-row gap-3">
                    <Stat label="durée" value={duration === null ? '—' : formatClock(duration)} />
                    <Stat label="repos" value={formatClock(restTotal)} />
                    <Stat label="séries" value={String(completedSetCount)} />
                  </View>
                </Card>
              </Pressable>
            );
          })}
          {matching.length > visible.length && (
            <Button
              label={`Afficher ${Math.min(PAGE, matching.length - visible.length)} séance${Math.min(PAGE, matching.length - visible.length) > 1 ? 's' : ''} de plus`}
              variant="secondary"
              size="md"
              onPress={() => setShown((count) => count + PAGE)}
            />
          )}
        </ScrollView>

        {/* C'est ici qu'on pense « il manque samedi » : l'historique est le
            seul écran où l'absence d'une séance se remarque. */}
        <Fab
          accessibilityLabel="Enregistrer une séance passée"
          onPress={() => router.push('/log-session')}
        />
      </View>

      <Sheet
        visible={menu}
        title="Historique"
        description="Tes données n'existent que sur ce téléphone. Une sauvegarde est un fichier que tu ranges où tu veux."
        actions={[
          { label: busy ? 'Préparation…' : 'Sauvegarder', onPress: backup },
          { label: 'Restaurer une sauvegarde', onPress: choose },
        ]}
        onClose={() => setMenu(false)}
      />

      <Sheet
        visible={restoring !== null}
        title="Restaurer cette sauvegarde ?"
        description={
          restoring
            ? `Du ${formatDateTime(restoring.exportedAt)} · ${restoring.exercises} exercice(s), ` +
              `${restoring.sessions} séance(s). Tout ce que contient l'application sera remplacé.`
            : undefined
        }
        actions={[{ label: 'Remplacer mes données', tone: 'danger', onPress: restore }]}
        onClose={() => setRestoring(null)}
      />

    </SafeAreaView>
  );
}

function StatusPill({ status }: { status: string }) {
  const done = status === 'COMPLETED';
  return (
    <View
      className={
        done
          ? 'rounded-full bg-[#E7F3C8] px-2 py-0.5 dark:bg-[#17281D]'
          : 'rounded-full bg-[#FDF1F0] px-2 py-0.5 dark:bg-[#2A1A16]'
      }
    >
      <Text
        className={
          done
            ? 'font-bold text-caption text-success dark:text-success-dark'
            : 'font-bold text-caption text-danger dark:text-danger-dark'
        }
      >
        {STATUS_LABEL[status] ?? status}
      </Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-lg bg-surface-alt px-3 py-2 dark:bg-surface-alt-dark">
      <Text
        className="font-mono-bold text-lead text-ink dark:text-ink-dark"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>
      <Text className="text-caption text-muted dark:text-muted-dark">{label}</Text>
    </View>
  );
}
