import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useNotifications } from '../src/ui/notifications';
import { messageOf } from '../src/ui/message';
import { useCallback, useState } from 'react';
import { Pressable, Share, Text, TextInput, View } from 'react-native';
import type { Exercise } from '../src/domain/exercise/exercise';
import type { Measurement } from '../src/domain/exercise/measurement';
import type { PlannedWorkout } from '../src/domain/planned-workout/planned-workout';
import { findAll as findAllExercises, findAllMeasurements } from '../src/infra/exercise-repository';
import { findAll as findAllPlans } from '../src/infra/planned-workout-repository';
import { Button } from '../src/ui/button';
import { Ionicons } from '@expo/vector-icons';
import { BodyMap } from '../src/ui/body-map';
import { Card } from '../src/ui/card';
import { formatEmomPace, formatTargets } from '../src/ui/set-values';
import { highlight } from '../src/ui/body-slugs';
import { Sheet } from '../src/ui/sheet';
import { discardWorkout, unarchiveWorkout } from '../src/use-cases/edit-catalogue';
import { duplicateWorkout } from '../src/use-cases/create-planned-workout';
import { describeWorkout } from '../src/use-cases/share-workout';
import { beginWorkoutSession } from '../src/use-cases/workout-session-actions';
import { usePalette } from '../src/ui/palette';
import { DetailContent, DetailFooter, DetailLayout } from '../src/ui/detail-layout';
import { SetIndex } from '../src/ui/set-index';

/**
 * Aperçu d'un entraînement. Le nom du fichier entre crochets en fait une route
 * DYNAMIQUE : /workouts/abc-123 ouvre cet écran avec id = "abc-123".
 *
 * Écran sans effet de bord : consulter un entraînement ne le démarre pas.
 */
export default function WorkoutDetailScreen() {
  const { muted } = usePalette();
  const { notify } = useNotifications();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<PlannedWorkout | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  /** Le menu de l'écran, et la confirmation qu'il peut demander. */
  const [sheet, setSheet] = useState<'none' | 'menu' | 'confirm-discard' | 'duplicate'>('none');
  /** Le nom proposé pour la copie, modifiable avant de la créer. */
  const [duplicateName, setDuplicateName] = useState('');
  const [duplicating, setDuplicating] = useState(false);

  // À chaque affichage : revenir de l'écran d'édition doit montrer
  // l'entraînement modifié, pas celui d'avant.
  useFocusEffect(
    useCallback(() => {
      Promise.all([findAllPlans(), findAllExercises(), findAllMeasurements()])
        .then(([plans, allExercises, allMeasurements]) => {
          setPlan(plans.find((candidate) => candidate.id === id) ?? null);
          setExercises(allExercises);
          setMeasurements(allMeasurements);
        })
        .catch((e) => notify(messageOf(e)));
    }, [id]),
  );

  const nameOf = (exerciseId: string) =>
    exercises.find((e) => e.id === exerciseId)?.name ?? exerciseId;
  const unitOf = (measurementId: string) =>
    measurements.find((m) => m.id === measurementId)?.unit ?? measurementId;

  /**
   * Démarrer pour de bon : cette fiche EST le palier.
   *
   * Elle montre déjà les exercices et leurs séries ; passer par l'écran
   * d'attente de la séance ferait relire la même chose pour appuyer un second
   * bouton. Depuis l'accueil, où l'on n'a vu qu'un nom, le palier garde tout
   * son sens -- il y est le premier endroit qui dit ce qu'on s'apprête à
   * faire.
   */
  function start() {
    beginWorkoutSession(id)
      .then(() => router.push('/session'))
      .catch((e) => notify(messageOf(e)));
  }

  if (!plan) {
    return (
      <DetailLayout title="Entraînement" onBack={() => router.back()}>
        <DetailContent>
          <Text className="text-muted dark:text-muted-dark">Entraînement introuvable.</Text>
        </DetailContent>
      </DetailLayout>
    );
  }

  const totalSets = plan.exercises.reduce((total, e) => total + e.sets.length, 0);

  /**
   * Les muscles de l'entraînement : ceux de ses exercices.
   *
   * Rien n'est stocké -- un entraînement ne déclare pas de muscles, il en
   * hérite de ce qu'il contient, et le jour où un exercice change de muscle
   * principal, sa fiche le dit sans qu'on ait rien à mettre à jour.
   */
  const planned = plan.exercises
    .map((entry) => exercises.find((exercise) => exercise.id === entry.exerciseId))
    .filter((exercise) => exercise !== undefined);

  const worked = highlight(
    planned.map((exercise) => exercise.primaryMuscleId).filter((id) => id !== null),
    planned.flatMap((exercise) => exercise.secondaryMuscleIds),
  );

  /** Archivé s'il a déjà produit des séances, supprimé sinon. */
  async function discard() {
    if (!plan) return;
    try {
      await discardWorkout(plan);
      router.back();
    } catch (e) {
      notify(messageOf(e));
    }
  }

  /** Partagée en texte : aucun format à installer pour la lire de l'autre côté. */
  function share() {
    if (!plan) return;
    Share.share({ message: describeWorkout(plan, nameOf, unitOf) }).catch((e) =>
      notify(messageOf(e)),
    );
  }

  /**
   * Dupliquer, c'est repartir d'un entraînement pour en varier un détail --
   * ici, sans quitter la fiche : le nom se propose déjà différent, mais reste
   * à confirmer, puisque deux entraînements ne peuvent pas se nommer pareil.
   */
  async function duplicate() {
    if (!plan) return;
    setDuplicating(true);
    try {
      const copy = await duplicateWorkout({ workout: plan, name: duplicateName });
      setSheet('none');
      router.push({ pathname: '/new-workout', params: { id: copy.id } });
    } catch (e) {
      notify(messageOf(e));
    } finally {
      setDuplicating(false);
    }
  }

  return (
    <DetailLayout
      title={plan.name}
      onMenu={() => setSheet('menu')}
      subtitle={`${plan.exercises.length} exercice${plan.exercises.length > 1 ? 's' : ''} · ${totalSets} série${totalSets > 1 ? 's' : ''} prévue${totalSets > 1 ? 's' : ''}`}
      onBack={() => router.back()}
    >
      <DetailContent className="gap-3">
        {/* Ce que l'entraînement travaille, avant ce qu'il contient : c'est
            la question qu'on se pose en ouvrant sa fiche. */}
        <BodyMap parts={worked} />


        {/* Dépliés d'office : un entraînement se lit d'un coup d'oeil, et le
            tap appartient alors sans ambiguïté à la fiche de l'exercice. */}
        {plan.exercises.map((planned, position) => (
          <Pressable
            key={`${planned.exerciseId}-${position}`}
            onPress={() =>
              router.push({ pathname: '/exercise', params: { id: planned.exerciseId } })
            }
          >
            <Card density="titled" className="gap-2">
              <View className="flex-row items-center justify-between gap-3">
                <Text
                  className="shrink font-bold text-body text-ink dark:text-ink-dark"
                  numberOfLines={1}
                >
                  {position + 1}. {nameOf(planned.exerciseId)}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={muted} />
              </View>

              {planned.sets.length === 0 ? (
                <Text className="text-small text-muted dark:text-muted-dark">
                  Aucune série prévue
                </Text>
              ) : (
                /* Du texte, pas des cadres : cinq encadrés sous chaque exercice
                   pesaient plus que ce qu'ils contenaient. La hiérarchie tient
                   au corps et à la couleur -- le nom en gras sombre, les séries
                   en chiffres alignés. */
                <View className="gap-2">
                  {/* Une annotation au-dessus de la liste, et non à sa place :
                      des rounds se lisent comme des séries, seule leur cadence
                      demande à être dite. */}
                  {planned.intervalSeconds ? (
                    <Text className="text-small text-muted dark:text-muted-dark">
                      {formatEmomPace(planned.intervalSeconds)}
                    </Text>
                  ) : null}
                  {/* Le rang dans sa pastille, la cible en gris « prévu » : le
                      même dessin que les séries faites de la fiche d'un
                      exercice, la couleur en moins -- une cible n'est pas
                      un fait. */}
                  {planned.sets.map((set, index) => (
                    <View key={index} className="flex-row items-center gap-2.5">
                      <SetIndex index={index + 1} />
                      <Text
                        className="shrink font-mono text-small text-planned dark:text-planned-dark"
                        style={{ fontVariant: ['tabular-nums'] }}
                      >
                        {formatTargets(set.targets, unitOf)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          </Pressable>
        ))}
      </DetailContent>

      {/* Action principale ancrée en bas, hors du défilement. */}
      <DetailFooter>
        <Button label="Démarrer la séance" size="lg" onPress={start} />
      </DetailFooter>

      <Sheet
        visible={sheet === 'menu'}
        title={plan.name}
        actions={
          plan.isArchived
            ? [
                {
                  label: 'Remettre au catalogue',
                  icon: 'arrow-undo-outline',
                  onPress: () =>
                    unarchiveWorkout(plan)
                      .then(() => router.back())
                      .catch((e) => notify(messageOf(e))),
                },
                { label: 'Partager', icon: 'share-outline', onPress: share },
              ]
            : [
                {
                  label: 'Modifier',
                  icon: 'create-outline',
                  onPress: () => router.push({ pathname: '/new-workout', params: { id } }),
                },
                {
                  label: 'Dupliquer',
                  icon: 'copy-outline',
                  onPress: () => {
                    setDuplicateName(`${plan.name} copie`);
                    setSheet('duplicate');
                  },
                },
                { label: 'Partager', icon: 'share-outline', onPress: share },
                {
                  label: 'Retirer du catalogue',
                  icon: 'archive-outline',
                  tone: 'danger' as const,
                  onPress: () => setSheet('confirm-discard'),
                },
              ]
        }
        onClose={() => setSheet('none')}
      />

      {/* Retirer n'est pas toujours la même opération : la base tranche entre
          archiver et supprimer. La confirmation annonce les deux, faute de
          pouvoir dire laquelle avant d'avoir regardé. */}
      <Sheet
        visible={sheet === 'confirm-discard'}
        title="Retirer cet entraînement ?"
        description="S'il a déjà produit des séances, il est archivé et reste attaché à ton historique. Sinon, il est supprimé."
        actions={[{ label: 'Retirer', icon: 'trash-outline', tone: 'danger', onPress: discard }]}
        onClose={() => setSheet('none')}
      />

      {/* Un nom proposé, pas imposé : la copie porte le même contenu, mais
          deux entraînements ne peuvent pas partager un nom -- l'erreur, si le
          nom choisi existe déjà, remonte par le toast global. */}
      <Sheet
        visible={sheet === 'duplicate'}
        title="Dupliquer l'entraînement"
        description="Le contenu est repris à l'identique ; seul le nom se choisit."
        onClose={() => setSheet('none')}
      >
        <View className="gap-3 pb-2">
          <TextInput
            className="h-14 rounded-lg border-[1.5px] border-border bg-surface px-4 text-strong text-ink dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
            placeholder="Nom de la copie"
            placeholderTextColor="#A8AD9E"
            value={duplicateName}
            onChangeText={setDuplicateName}
            autoFocus
          />
          <Button
            label="Dupliquer"
            size="md"
            disabled={duplicateName.trim() === '' || duplicating}
            onPress={duplicate}
          />
        </View>
      </Sheet>
    </DetailLayout>
  );
}
