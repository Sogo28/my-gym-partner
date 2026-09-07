import { useFocusEffect } from 'expo-router';
import { messageOf } from '../../src/ui/message';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Exercise } from '../../src/domain/exercise/exercise';
import type { Measurement } from '../../src/domain/exercise/measurement';
import type { PlannedWorkout } from '../../src/domain/planned-workout/planned-workout';
import type { Side, ValuesBySide } from '../../src/domain/performance/exercise-performance';
import { findAll as findAllExercises, findAllMeasurements } from '../../src/infra/exercise-repository';
import { findAll as findAllPlans } from '../../src/infra/planned-workout-repository';
import { listSessionSummaries, type SessionSummary } from '../../src/use-cases/session-summary';
import {
  applyBackup,
  pickBackup,
  shareBackup,
  type BackupPreview,
} from '../../src/use-cases/backup-actions';
import { Button } from '../../src/ui/button';
import { Collapsible } from '../../src/ui/collapsible';
import { NumberField } from '../../src/ui/number-field';
import { Sheet } from '../../src/ui/sheet';
import { EmptyState } from '../../src/ui/empty-state';
import { SectionHeader } from '../../src/ui/screen-header';
import { SetRow } from '../../src/ui/set-row';
import { formatClock, formatDateTime } from '../../src/ui/format';
import { formatSetValues } from '../../src/ui/set-values';
import { correctPastSet } from '../../src/use-cases/correct-past-set';

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
  const [summaries, setSummaries] = useState<SessionSummary[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [plans, setPlans] = useState<PlannedWorkout[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** La série ouverte à la correction, s'il y en a une. */
  const [editing, setEditing] = useState<{
    performanceId: string;
    setIndex: number;
    measurementIds: readonly string[];
    values: ValuesBySide;
  } | null>(null);
  /** La sauvegarde choisie, en attente de confirmation. */
  const [restoring, setRestoring] = useState<BackupPreview | null>(null);
  /** La période affichée, en jours. Null : tout l'historique. */
  const [period, setPeriod] = useState<number | null>(90);
  /** Combien de séances on montre ; le reste attend « afficher plus ». */
  const [shown, setShown] = useState(PAGE);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    // Le résumé est calculé par le use case : l'écran ne fait plus que
    // l'afficher.
    const [allSummaries, allExercises, allMeasurements, allPlans] = await Promise.all([
      listSessionSummaries(),
      findAllExercises(),
      findAllMeasurements(),
      findAllPlans(),
    ]);

    setSummaries(allSummaries);
    setExercises(allExercises);
    setMeasurements(allMeasurements);
    setPlans(allPlans);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => setError(messageOf(e)));
    }, [load]),
  );

  async function saveCorrection() {
    if (!editing) return;
    try {
      await correctPastSet({
        performanceId: editing.performanceId,
        setIndex: editing.setIndex,
        values: editing.values,
      });
      setEditing(null);
      await load();
      setError(null);
    } catch (e) {
      setError(messageOf(e));
    }
  }

  const nameOf = (id: string) => exercises.find((e) => e.id === id)?.name ?? id;
  const unitOf = (id: string) => measurements.find((m) => m.id === id)?.unit ?? id;

  const thisMonth = summaries.filter(
    ({ session }) =>
      session.startedAt.getMonth() === new Date().getMonth() &&
      session.startedAt.getFullYear() === new Date().getFullYear(),
  ).length;

  async function backup() {
    setBusy(true);
    try {
      await shareBackup();
      setError(null);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  async function choose() {
    try {
      setRestoring(await pickBackup());
      setError(null);
    } catch (e) {
      setError(messageOf(e));
    }
  }

  async function restore() {
    if (!restoring) return;
    const chosen = restoring;
    setRestoring(null);
    try {
      await applyBackup(chosen.backup);
      await load();
      setError(null);
    } catch (e) {
      setError(messageOf(e));
    }
  }

  // Le filtre porte sur la date de DÉBUT : c'est elle qui situe la séance,
  // même pour une séance à cheval sur deux jours.
  const since = period === null ? null : new Date(Date.now() - period * 86_400_000);
  const inPeriod = summaries.filter(
    ({ session }) => since === null || session.startedAt >= since,
  );
  const visible = inPeriod.slice(0, shown);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
      <View className="gap-3 px-5 pt-4">
        <SectionHeader
          title="Historique"
          subtitle={`${summaries.length} séance${summaries.length > 1 ? 's' : ''} · ${thisMonth} ce mois-ci`}
        />

        <View className="flex-row gap-2 pb-1">
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
                      ? 'font-bold text-[13px] text-ink'
                      : 'text-[13px] text-muted dark:text-muted-dark'
                  }
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerClassName="gap-3 px-5 pb-6">
        {error && <Text className="text-danger dark:text-danger-dark">{error}</Text>}
        {summaries.length === 0 && (
          <EmptyState
            title="Aucun historique"
            description="Tes séances terminées apparaîtront ici, avec leurs séries et leurs temps de repos."
          />
        )}

        {summaries.length > 0 && inPeriod.length === 0 && (
          <EmptyState
            title="Rien sur cette période"
            description="Élargis la période pour retrouver tes séances plus anciennes."
          />
        )}

        {visible.map(({ session, duration, restTotal, completedSetCount, activities }, position) => {
          const plan = plans.find((p) => p.id === session.plannedWorkoutId);
          const date = session.startedAt;

          return (
            <Collapsible
              key={session.id}
              // La dernière séance est celle qu'on vient revoir ; les autres
              // attendent qu'on les demande.
              defaultOpen={position === 0}
              title={
                <View className="shrink">
                  <Text className="font-extrabold text-[18px] text-ink dark:text-ink-dark">
                    {plan ? plan.name : 'Séance libre'}
                  </Text>
                  <Text className="font-mono text-[12px] text-muted dark:text-muted-dark">
                    {formatDateTime(date)}
                  </Text>
                </View>
              }
              summary={<StatusPill status={session.status} />}
            >
              <View className="flex-row gap-3 pt-1">
                <Stat label="durée" value={duration === null ? '—' : formatClock(duration)} />
                <Stat label="repos" value={formatClock(restTotal)} />
                <Stat label="séries" value={String(completedSetCount)} />
              </View>

{activities.map((activity, index) => (
                <View key={index} className="mt-2 gap-1.5">
                  <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
                    {nameOf(activity.exerciseId)}
                  </Text>

                  {activity.completedSets.length === 0 ? (
                    <Text className="text-[13px] text-muted dark:text-muted-dark">
                      aucune série complétée
                    </Text>
                  ) : (
                    activity.completedSets.map(({ set, index: setIndex, restBefore }, position) => (
                      <View key={setIndex} className="gap-1.5">
                        {restBefore ? (
                          <Text className="pl-4 font-mono text-[12px] text-muted dark:text-muted-dark">
                            repos {formatClock(restBefore)}
                          </Text>
                        ) : null}
                        <SetRow
                          index={position + 1}
                          status="completed"
                          values={formatSetValues(set.values, unitOf)}
                          // Une faute de saisie doit pouvoir se réparer, même
                          // des semaines plus tard.
                          onPress={
                            activity.performanceId
                              ? () =>
                                  setEditing({
                                    performanceId: activity.performanceId!,
                                    // Le rang réel dans la performance, fourni
                                    // par le résumé.
                                    setIndex,
                                    measurementIds: activity.measurementIds,
                                    values: { ...set.values },
                                  })
                              : undefined
                          }
                        />
                      </View>
                    ))
                  )}
                </View>
              ))}
            </Collapsible>
          );
        })}
        {inPeriod.length > visible.length && (
          <Button
            label={`Afficher ${Math.min(PAGE, inPeriod.length - visible.length)} séance${Math.min(PAGE, inPeriod.length - visible.length) > 1 ? 's' : ''} de plus`}
            variant="secondary"
            size="md"
            onPress={() => setShown((count) => count + PAGE)}
          />
        )}

        <View className="mt-4 gap-2 border-t border-border pt-4 dark:border-border-dark">
          <Text className="text-[13px] text-muted dark:text-muted-dark">
            Tes données n'existent que sur ce téléphone. Une sauvegarde est un fichier que tu
            ranges où tu veux.
          </Text>
          <View className="flex-row gap-2">
            <Button
              label={busy ? 'Préparation…' : 'Sauvegarder'}
              variant="secondary"
              size="md"
              className="flex-1"
              disabled={busy}
              onPress={backup}
            />
            <Button
              label="Restaurer"
              variant="secondary"
              size="md"
              className="flex-1"
              onPress={choose}
            />
          </View>
        </View>
      </ScrollView>

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

      <Sheet
        visible={editing !== null}
        title={`Corriger la série ${(editing?.setIndex ?? 0) + 1}`}
        description="La performance reste ce que tu déclares avoir fait."
        onClose={() => setEditing(null)}
      >
        {editing && (
          <View className="gap-3 pb-2">
            {/* Une rangée par côté : un exercice unilatéral en a deux. */}
            {(Object.keys(editing.values) as Side[]).map((side) => (
              <View key={side} className="gap-1">
                {side !== 'BOTH' && (
                  <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
                    {side === 'LEFT' ? 'Côté gauche' : 'Côté droit'}
                  </Text>
                )}
                <View className="flex-row gap-3">
                  {editing.measurementIds.map((id) => (
                    <NumberField
                      key={id}
                      unit={unitOf(id)}
                      value={editing.values[side]?.[id] ?? 0}
                      step={id === 'weight' ? 2.5 : 1}
                      onChange={(value) =>
                        setEditing((current) =>
                          current
                            ? {
                                ...current,
                                values: {
                                  ...current.values,
                                  [side]: { ...(current.values[side] ?? {}), [id]: value },
                                },
                              }
                            : current,
                        )
                      }
                    />
                  ))}
                </View>
              </View>
            ))}
            <Button label="Enregistrer" size="md" onPress={saveCorrection} />
          </View>
        )}
      </Sheet>
    </SafeAreaView>
  );
}

function StatusPill({ status }: { status: string }) {
  const done = status === 'COMPLETED';
  return (
    <View
      className={
        done
          ? 'rounded-full bg-[#E7F3C8] px-2.5 py-1 dark:bg-[#17281D]'
          : 'rounded-full bg-[#FDF1F0] px-2.5 py-1 dark:bg-[#2A1A16]'
      }
    >
      <Text
        className={
          done
            ? 'font-bold text-[11px] text-success dark:text-success-dark'
            : 'font-bold text-[11px] text-danger dark:text-danger-dark'
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
        className="font-mono-bold text-[15px] text-ink dark:text-ink-dark"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>
      <Text className="text-[11px] text-muted dark:text-muted-dark">{label}</Text>
    </View>
  );
}
