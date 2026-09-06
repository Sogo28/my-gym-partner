import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Exercise } from '../src/domain/exercise/exercise';
import type { Measurement } from '../src/domain/exercise/measurement';
import type { PlannedWorkout } from '../src/domain/planned-workout/planned-workout';
import { findAll as findAllExercises, findAllMeasurements } from '../src/infra/exercise-repository';
import { findAll as findAllPlans } from '../src/infra/planned-workout-repository';
import { listSessionSummaries, type SessionSummary } from '../src/use-cases/session-summary';
import { Button } from '../src/ui/button';
import { Card } from '../src/ui/card';
import { NumberField } from '../src/ui/number-field';
import { Sheet } from '../src/ui/sheet';
import { EmptyState } from '../src/ui/empty-state';
import { SectionHeader } from '../src/ui/screen-header';
import { SetRow } from '../src/ui/set-row';
import { formatClock } from '../src/ui/timer';
import { correctPastSet } from '../src/use-cases/correct-past-set';

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
    values: Record<string, number>;
  } | null>(null);

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
      load().catch((e) => setError(String(e)));
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
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const nameOf = (id: string) => exercises.find((e) => e.id === id)?.name ?? id;
  const unitOf = (id: string) => measurements.find((m) => m.id === id)?.unit ?? id;

  const thisMonth = summaries.filter(
    ({ session }) =>
      session.startedAt.getMonth() === new Date().getMonth() &&
      session.startedAt.getFullYear() === new Date().getFullYear(),
  ).length;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-5 pt-4">
        <SectionHeader
          title="Historique"
          subtitle={`${summaries.length} séance${summaries.length > 1 ? 's' : ''} · ${thisMonth} ce mois-ci`}
        />
      </View>

      <ScrollView contentContainerClassName="gap-3 px-5 pb-6">
        {error && <Text className="text-danger dark:text-danger-dark">{error}</Text>}
        {summaries.length === 0 && (
          <EmptyState
            title="Aucun historique"
            description="Tes séances terminées apparaîtront ici, avec leurs séries et leurs temps de repos."
          />
        )}

        {summaries.map(({ session, duration, restTotal, completedSetCount, activities }) => {
          const plan = plans.find((p) => p.id === session.plannedWorkoutId);
          const date = session.startedAt;

          return (
            <Card key={session.id} density="titled" className="gap-2">
              <View className="flex-row items-start justify-between gap-3">
                <View className="shrink">
                  <Text className="font-extrabold text-[18px] text-ink dark:text-ink-dark">
                    {plan ? plan.name : 'Séance libre'}
                  </Text>
                  <Text className="font-mono text-[12px] text-muted dark:text-muted-dark">
                    {date.toLocaleDateString('fr-FR')} ·{' '}
                    {String(date.getHours()).padStart(2, '0')}:
                    {String(date.getMinutes()).padStart(2, '0')}
                  </Text>
                </View>
                <StatusPill status={session.status} />
              </View>

              <View className="flex-row gap-3">
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
                          values={Object.entries(set.values)
                            .map(([id, value]) => `${value} ${unitOf(id)}`)
                            .join(' · ')}
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
            </Card>
          );
        })}
      </ScrollView>

      <Sheet
        visible={editing !== null}
        title={`Corriger la série ${(editing?.setIndex ?? 0) + 1}`}
        description="La performance reste ce que tu déclares avoir fait."
        onClose={() => setEditing(null)}
      >
        {editing && (
          <View className="gap-3 pb-2">
            <View className="flex-row gap-3">
              {editing.measurementIds.map((id) => (
                <NumberField
                  key={id}
                  unit={unitOf(id)}
                  value={editing.values[id] ?? 0}
                  step={id === 'weight' ? 2.5 : 1}
                  onChange={(value) =>
                    setEditing((current) =>
                      current ? { ...current, values: { ...current.values, [id]: value } } : current,
                    )
                  }
                />
              ))}
            </View>
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
