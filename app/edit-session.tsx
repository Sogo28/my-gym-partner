import { Ionicons } from '@expo/vector-icons';
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
import { MeasureField } from '../src/ui/measure-field';
import { useNotifications } from '../src/ui/notifications';
import { BackHeader } from '../src/ui/screen-header';
import { Sheet } from '../src/ui/sheet';
import { formatSetValues } from '../src/ui/set-values';
import { SetVideoViewer } from '../src/ui/set-video';
import { correctPastSet } from '../src/use-cases/correct-past-set';
import { fileUri } from '../src/use-cases/media-actions';
import { findSessionSummary, type SessionSummary } from '../src/use-cases/session-summary';
import { detachSetVideo } from '../src/use-cases/set-video';

/** Le pas d'ajustement dépend de la mesure : on n'ajoute pas 1 kg comme 1 rep. */
const STEPS: Record<string, number> = { reps: 1, weight: 2.5, duration: 1, distance: 10 };

/** La série qu'on règle : de quoi la retrouver, et de quoi l'afficher. */
type Editing = {
  performanceId: string;
  setIndex: number;
  exerciseName: string;
  position: number;
  measurementIds: readonly string[];
};

/**
 * Revenir sur une séance passée.
 *
 * Une série SE LIT, et ne se règle qu'en la touchant -- le même partage que
 * pour les conditions d'un objectif. Étaler les champs de chaque série ferait
 * une page de réglages où la séance elle-même disparaîtrait, alors qu'on n'en
 * corrige qu'une à la fois.
 *
 * Ce qu'on corrige reste ce qu'on DÉCLARE avoir fait : une performance est un
 * fait daté, pas une mesure d'appareil (§11).
 */
export default function EditSessionScreen() {
  const { notify } = useNotifications();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [watching, setWatching] = useState<Editing | null>(null);

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

  /** La série visée, relue à chaque rendu : c'est la base qui fait foi. */
  const setOf = (target: Editing | null) =>
    target
      ? summary?.activities
          .find((activity) => activity.performanceId === target.performanceId)
          ?.completedSets.find((entry) => entry.index === target.setIndex)?.set
      : undefined;

  const edited = setOf(editing);
  const watched = setOf(watching);

  /**
   * Écrit à chaque pas, comme pendant la séance : il n'y a rien à confirmer,
   * donc rien à oublier de confirmer.
   */
  function adjust(side: Side, measurementId: string, value: number) {
    if (!editing || !edited) return;
    correctPastSet({
      performanceId: editing.performanceId,
      setIndex: editing.setIndex,
      values: {
        ...edited.values,
        [side]: { ...(edited.values[side] ?? {}), [measurementId]: value },
      },
    })
      .then(reload)
      .catch((e) => notify(messageOf(e)));
  }

  function removeVideo(target: Editing) {
    detachSetVideo(target.performanceId, target.setIndex)
      .then(reload)
      .then(() => notify('Vidéo supprimée.', 'success'))
      .catch((e) => notify(messageOf(e)));
  }

  const nothingToEdit =
    summary?.activities.every((activity) => activity.completedSets.length === 0) ?? false;

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

      <ScrollView contentContainerClassName="gap-3 px-5 pb-8" keyboardShouldPersistTaps="handled">
        {nothingToEdit && (
          <EmptyState
            title="Rien à modifier"
            description="Cette séance n a validé aucune série."
          />
        )}

        {summary?.activities.map((activity, index) => {
          if (activity.completedSets.length === 0 || !activity.performanceId) return null;
          const performanceId = activity.performanceId;
          const exerciseName = nameOf(activity.exerciseId);

          return (
            <Card key={index} density="titled" className="gap-1">
              <Text
                className="pb-1 font-bold text-body text-ink dark:text-ink-dark"
                numberOfLines={1}
              >
                {exerciseName}
              </Text>

              {/* La série à gauche, ses valeurs à droite : c'est le chiffre
                  qu'on cherche du regard en relisant une séance. Une seule
                  cible par ligne, et elle ouvre tout ce qu'on peut en faire. */}
              {activity.completedSets.map(({ set, index: setIndex }, position) => (
                <Pressable
                  key={setIndex}
                  onPress={() =>
                    setEditing({
                      performanceId,
                      // Le rang RÉEL dans la performance, abandons compris :
                      // le résumé le fournit, et le recalculer désignerait de
                      // travers.
                      setIndex,
                      exerciseName,
                      position: position + 1,
                      measurementIds: activity.measurementIds,
                    })
                  }
                  className="flex-row items-baseline justify-between gap-3 border-b border-border py-2.5 dark:border-border-dark"
                >
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-small text-muted dark:text-muted-dark">
                      Série {position + 1}
                    </Text>
                    {/* Un repère, pas une cible : il DIT qu'une vidéo existe,
                        et c'est la ligne entière qui l'ouvre. */}
                    {set.videoUri && <Ionicons name="videocam" size={13} color="#8B9086" />}
                  </View>
                  <Text
                    className="font-mono-bold text-lead text-ink dark:text-ink-dark"
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    {formatSetValues(set.values, unitOf)}
                  </Text>
                </Pressable>
              ))}
            </Card>
          );
        })}
      </ScrollView>

      {/* Une seule feuille pour toutes les séries : celle qu'on règle dit ce
          qu'elle montre. */}
      <Sheet
        visible={editing !== null && edited !== undefined}
        title={editing ? `Série ${editing.position}` : ''}
        description={editing?.exerciseName}
        actions={
          edited?.videoUri && editing
            ? [
                { label: 'Voir la vidéo', onPress: () => setWatching(editing) },
                {
                  label: 'Supprimer la vidéo',
                  tone: 'danger' as const,
                  onPress: () => removeVideo(editing),
                },
              ]
            : []
        }
        onClose={() => setEditing(null)}
      >
        {editing && edited && (
          <View className="gap-4 pb-2">
            {/* Une rangée par côté : un exercice unilatéral en a deux. */}
            {(Object.keys(edited.values) as Side[]).map((side) => (
              <View key={side} className="gap-1">
                {side !== 'BOTH' && (
                  <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
                    {side === 'LEFT' ? 'Côté gauche' : 'Côté droit'}
                  </Text>
                )}
                <View className="flex-row gap-3">
                  {editing.measurementIds.map((measurementId) => (
                    <MeasureField
                      key={measurementId}
                      compact
                      unit={unitOf(measurementId)}
                      value={edited.values[side]?.[measurementId] ?? 0}
                      step={STEPS[measurementId] ?? 1}
                      onChange={(value) => adjust(side, measurementId, value)}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </Sheet>

      <SetVideoViewer
        uri={watched?.videoUri ? fileUri(watched.videoUri) : null}
        onClose={() => setWatching(null)}
        onDelete={() => {
          const target = watching;
          setWatching(null);
          if (target) removeVideo(target);
        }}
      />
    </SafeAreaView>
  );
}
