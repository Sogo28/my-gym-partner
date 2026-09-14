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
import { DatePickerSheet } from '../src/ui/date-picker';
import { EmptyState } from '../src/ui/empty-state';
import { formatDateTime } from '../src/ui/format';
import { messageOf } from '../src/ui/message';
import { MeasureField } from '../src/ui/measure-field';
import { useNotifications } from '../src/ui/notifications';
import { BackHeader } from '../src/ui/screen-header';
import { Sheet } from '../src/ui/sheet';
import { formatSetValues } from '../src/ui/set-values';
import { SetVideoViewer } from '../src/ui/set-video';
import { correctPastSet, removePastSet } from '../src/use-cases/correct-past-set';
import { moveSession } from '../src/use-cases/move-session';
import { fileUri, pickSetVideo } from '../src/use-cases/media-actions';
import { findSessionSummary, type SessionSummary } from '../src/use-cases/session-summary';
import { attachSetVideo, detachSetVideo } from '../src/use-cases/set-video';


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
  /** Le calendrier ouvert pour corriger quand la séance a eu lieu. */
  const [moving, setMoving] = useState(false);

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

  /**
   * Attacher après coup une captation prise hors de l'app -- avec l'appareil
   * photo du téléphone, par exemple -- sans passer par l'enregistrement en
   * direct d'une séance.
   */
  function addVideo(target: Editing) {
    pickSetVideo()
      .then((name) => (name ? attachSetVideo(target.performanceId, target.setIndex, name) : undefined))
      .then(reload)
      .catch((e) => notify(messageOf(e)));
  }

  /**
   * Fermer la feuille avant de recharger : après suppression, l'index visé
   * ne désigne plus la même série -- ou plus aucune -- et la garder ouverte
   * la ferait rouvrir sur autre chose que ce qu'on a retiré.
   */
  function removeSet(target: Editing) {
    setEditing(null);
    removePastSet({ performanceId: target.performanceId, setIndex: target.setIndex })
      .then(reload)
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
        {/* Quand la séance a eu lieu se corrige comme ce qu'elle a mesuré :
            une séance saisie le lendemain porte la date du lendemain, et la
            corriger, c'est dire ce qui s'est passé. */}
        {summary && (
          <Pressable onPress={() => setMoving(true)}>
            <Card density="titled" className="flex-row items-center justify-between gap-3">
              <View className="shrink">
                <Text className="font-bold text-body text-ink dark:text-ink-dark">
                  Date et heure
                </Text>
                <Text className="font-mono text-caption text-muted dark:text-muted-dark">
                  {formatDateTime(summary.session.startedAt)}
                </Text>
              </View>
              <Text className="text-caption text-primary-ink dark:text-primary-ink-dark">
                modifier
              </Text>
            </Card>
          </Pressable>
        )}

        {nothingToEdit && (
          <EmptyState
            title="Aucune série à corriger"
            description="Cette séance n a validé aucune série. Sa date, elle, reste modifiable."
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
          editing
            ? [
                ...(edited?.videoUri
                  ? [
                      { label: 'Voir la vidéo', onPress: () => setWatching(editing) },
                      {
                        label: 'Supprimer la vidéo',
                        tone: 'danger' as const,
                        onPress: () => removeVideo(editing),
                      },
                    ]
                  : [{ label: 'Ajouter une vidéo', onPress: () => addVideo(editing) }]),
                {
                  label: 'Retirer cette série',
                  tone: 'danger' as const,
                  onPress: () => removeSet(editing),
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
                      measurementId={measurementId}
                      value={edited.values[side]?.[measurementId] ?? 0}
                      onChange={(value) => adjust(side, measurementId, value)}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </Sheet>

      <DatePickerSheet
        visible={moving}
        title="Quand cette séance a eu lieu"
        confirmLabel="Déplacer"
        initial={summary?.session.startedAt}
        onConfirm={(at) => {
          setMoving(false);
          moveSession(id, at)
            .then(reload)
            .catch((e) => notify(messageOf(e)));
        }}
        onClose={() => setMoving(false)}
      />

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
