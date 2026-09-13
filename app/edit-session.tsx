import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Exercise } from '../src/domain/exercise/exercise';
import type { Measurement } from '../src/domain/exercise/measurement';
import type { Side } from '../src/domain/performance/exercise-performance';
import { findAll as findAllExercises, findAllMeasurements } from '../src/infra/exercise-repository';
import { Card } from '../src/ui/card';
import { EmptyState } from '../src/ui/empty-state';
import { messageOf } from '../src/ui/message';
import { NumberField } from '../src/ui/number-field';
import { useNotifications } from '../src/ui/notifications';
import { BackHeader } from '../src/ui/screen-header';
import { SetVideoViewer, VideoBadge } from '../src/ui/set-video';
import { correctPastSet } from '../src/use-cases/correct-past-set';
import { fileUri } from '../src/use-cases/media-actions';
import { findSessionSummary, type SessionSummary } from '../src/use-cases/session-summary';
import { detachSetVideo } from '../src/use-cases/set-video';

/** Le pas d'ajustement dépend de la mesure : on n'ajoute pas 1 kg comme 1 rep. */
const STEPS: Record<string, number> = { reps: 1, weight: 2.5, duration: 1, distance: 10 };

/**
 * Revenir sur une séance passée.
 *
 * Un écran à part, et non des gestes semés dans la fiche : celle-ci se LIT,
 * et trois cibles voisines -- dont une ligne de série -- s'y rataient l'une
 * pour l'autre. Ici chaque série a la place de ses champs, et rien d'autre ne
 * réclame le doigt.
 *
 * Ce qu'on corrige reste ce qu'on DÉCLARE avoir fait : la performance est un
 * fait daté, pas une mesure d'appareil (§11).
 */
export default function EditSessionScreen() {
  const { notify } = useNotifications();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [watching, setWatching] = useState<{ setIndex: number; performanceId: string } | null>(
    null,
  );

  const reload = useCallback(async () => {
    const [found, allExercises, allMeasurements] = await Promise.all([
      findSessionSummary(id),
      findAllExercises(),
      findAllMeasurements(),
    ]);
    setSummary(found);
    setExercises(allExercises);
    setMeasurements(allMeasurements);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      reload().catch((e) => notify(messageOf(e)));
    }, [reload]),
  );

  const nameOf = (exerciseId: string) =>
    exercises.find((e) => e.id === exerciseId)?.name ?? exerciseId;
  const unitOf = (measurementId: string) =>
    measurements.find((m) => m.id === measurementId)?.unit ?? measurementId;

  /**
   * Écrit à chaque pas, comme pendant la séance : il n'y a rien à confirmer,
   * donc rien à oublier de confirmer.
   */
  function adjust(
    performanceId: string,
    setIndex: number,
    values: Record<string, Record<string, number>>,
  ) {
    correctPastSet({ performanceId, setIndex, values })
      .then(reload)
      .catch((e) => notify(messageOf(e)));
  }

  const watched = watching
    ? summary?.activities
        .find((activity) => activity.performanceId === watching.performanceId)
        ?.completedSets.find((entry) => entry.index === watching.setIndex)?.set.videoUri
    : null;

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      className="flex-1 bg-background pb-3 dark:bg-background-dark"
    >
      <View className="px-5 pt-4">
        <BackHeader
          title="Modifier la séance"
          subtitle="ce que tu déclares avoir fait"
          onBack={() => router.back()}
        />
      </View>

      <ScrollView contentContainerClassName="gap-4 px-5 pb-8" keyboardShouldPersistTaps="handled">
        {summary?.activities.every((activity) => activity.completedSets.length === 0) && (
          <EmptyState
            title="Rien à modifier"
            description="Cette séance n a validé aucune série."
          />
        )}

        {summary?.activities.map((activity, index) => {
          if (activity.completedSets.length === 0 || !activity.performanceId) return null;
          const performanceId = activity.performanceId;

          return (
            <View key={index} className="gap-2">
              <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
                {nameOf(activity.exerciseId)}
              </Text>

              {activity.completedSets.map(({ set, index: setIndex }, position) => (
                <Card key={setIndex} density="titled" className="gap-3">
                  <View className="flex-row items-center justify-between gap-3">
                    <Text className="font-bold text-body text-ink dark:text-ink-dark">
                      Série {position + 1}
                    </Text>
                    {set.videoUri && (
                      <VideoBadge
                        onPress={() => setWatching({ performanceId, setIndex })}
                      />
                    )}
                  </View>

                  {/* Une rangée par côté : un exercice unilatéral en a deux. */}
                  {(Object.keys(set.values) as Side[]).map((side) => (
                    <View key={side} className="gap-1">
                      {side !== 'BOTH' && (
                        <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
                          {side === 'LEFT' ? 'Côté gauche' : 'Côté droit'}
                        </Text>
                      )}
                      <View className="flex-row gap-3">
                        {activity.measurementIds.map((measurementId) => (
                          <NumberField
                            key={measurementId}
                            compact
                            unit={unitOf(measurementId)}
                            value={set.values[side]?.[measurementId] ?? 0}
                            step={STEPS[measurementId] ?? 1}
                            onChange={(value) =>
                              adjust(performanceId, setIndex, {
                                ...(set.values as Record<string, Record<string, number>>),
                                [side]: {
                                  ...(set.values[side] ?? {}),
                                  [measurementId]: value,
                                },
                              })
                            }
                          />
                        ))}
                      </View>
                    </View>
                  ))}

                  {set.videoUri && (
                    <Pressable
                      className="self-end"
                      onPress={() =>
                        detachSetVideo(performanceId, setIndex)
                          .then(reload)
                          .then(() => notify('Vidéo supprimée.', 'success'))
                          .catch((e) => notify(messageOf(e)))
                      }
                    >
                      <Text className="text-caption text-danger dark:text-danger-dark">
                        Supprimer la vidéo
                      </Text>
                    </Pressable>
                  )}
                </Card>
              ))}
            </View>
          );
        })}
      </ScrollView>

      <SetVideoViewer
        uri={watched ? fileUri(watched) : null}
        onClose={() => setWatching(null)}
        onDelete={() => {
          const target = watching;
          setWatching(null);
          if (!target) return;
          detachSetVideo(target.performanceId, target.setIndex)
            .then(reload)
            .then(() => notify('Vidéo supprimée.', 'success'))
            .catch((e) => notify(messageOf(e)));
        }}
      />
    </SafeAreaView>
  );
}
