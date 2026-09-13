import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Exercise } from '../src/domain/exercise/exercise';
import type { Side, ValuesBySide } from '../src/domain/performance/exercise-performance';
import type { Measurement } from '../src/domain/exercise/measurement';
import type { PlannedWorkout } from '../src/domain/planned-workout/planned-workout';
import { findAll as findAllExercises, findAllMeasurements } from '../src/infra/exercise-repository';
import { findAll as findAllPlans } from '../src/infra/planned-workout-repository';
import { BodyMap } from '../src/ui/body-map';
import { highlight } from '../src/ui/body-slugs';
import { Button } from '../src/ui/button';
import { NumberField } from '../src/ui/number-field';
import { Card } from '../src/ui/card';
import { formatClock, formatDateTime } from '../src/ui/format';
import { GoalCard } from '../src/ui/goal-card';
import { messageOf } from '../src/ui/message';
import { useNotifications } from '../src/ui/notifications';
import { BackHeader } from '../src/ui/screen-header';
import { Sheet } from '../src/ui/sheet';
import { formatSetValues } from '../src/ui/set-values';
import { SetVideoViewer, VideoBadge } from '../src/ui/set-video';
import { fileUri, forgetUnusedMedia } from '../src/use-cases/media-actions';
import { detachSetVideo } from '../src/use-cases/set-video';
import { advanceProgression, goalsReachedBy, type ReachedGoal } from '../src/use-cases/goal-actions';
import { correctPastSet } from '../src/use-cases/correct-past-set';
import { eraseSession } from '../src/use-cases/erase-history';
import {
  findSessionSummary,
  type ActivitySummary,
  type SessionSummary,
} from '../src/use-cases/session-summary';

/**
 * Ce qu'on vient de faire, une fois la séance close.
 *
 * Un bilan et non un écran de plus à traverser : il se lit, il ne se remplit
 * pas. Il répond à trois questions qu'on se pose en rangeant ses affaires --
 * qu'est-ce que j'ai travaillé, ai-je fait ce qui était prévu, et est-ce que
 * ça fait avancer quelque chose.
 */
export default function SessionSummaryScreen() {
  const { notify } = useNotifications();
  const router = useRouter();
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();

  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [plans, setPlans] = useState<PlannedWorkout[]>([]);
  const [reached, setReached] = useState<ReachedGoal[]>([]);
  const [sheet, setSheet] = useState<'none' | 'menu' | 'confirm'>('none');
  /** La captation ouverte, et la série d'où elle vient. */
  const [watching, setWatching] = useState<{
    performanceId: string;
    setIndex: number;
    name: string;
  } | null>(null);
  /** L'exercice dont on a ouvert le menu, avec ses séries. */
  const [acting, setActing] = useState<ActivitySummary | null>(null);
  /**
   * La série ouverte à la correction.
   *
   * Elle vit ICI depuis que l'historique ne déplie plus ses séances : c'est
   * la fiche qui montre le détail, donc c'est elle qui doit permettre de le
   * corriger. Une faute de saisie doit pouvoir se réparer, même des semaines
   * plus tard.
   */
  const [editing, setEditing] = useState<{
    performanceId: string;
    setIndex: number;
    measurementIds: readonly string[];
    values: ValuesBySide;
  } | null>(null);

  const reload = useCallback(async () => {
    const [found, allExercises, allMeasurements, allPlans] = await Promise.all([
      findSessionSummary(id),
      findAllExercises(),
      findAllMeasurements(),
      findAllPlans(),
    ]);
    setSummary(found);
    setExercises(allExercises);
    setMeasurements(allMeasurements);
    setPlans(allPlans);

    // Les objectifs que CETTE séance met à portée : les autres étaient déjà
    // acquis avant d'entrer dans la salle.
    const worked = [...new Set((found?.activities ?? []).map((entry) => entry.exerciseId))];
    setReached(await goalsReachedBy(worked));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      reload().catch((e) => notify(messageOf(e)));
    }, [reload]),
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
      await reload();
    } catch (e) {
      notify(messageOf(e));
    }
  }

  const exerciseOf = (exerciseId: string) => exercises.find((e) => e.id === exerciseId);
  const nameOf = (exerciseId: string) => exerciseOf(exerciseId)?.name ?? exerciseId;
  const unitOf = (measurementId: string | null) =>
    measurementId === null
      ? ''
      : (measurements.find((m) => m.id === measurementId)?.unit ?? measurementId);

  if (!summary) {
    return (
      <SafeAreaView
        edges={['top', 'bottom']}
        className="flex-1 bg-background p-5 dark:bg-background-dark"
      >
        <Text className="text-muted dark:text-muted-dark">Séance introuvable.</Text>
      </SafeAreaView>
    );
  }

  const plan = plans.find((candidate) => candidate.id === summary.session.plannedWorkoutId);

  // Un exercice ne compte comme travaillé que s'il a produit une série : en
  // ouvrir un puis passer au suivant n'a rien fait travailler.
  const worked = summary.activities
    .filter((activity) => activity.completedSets.length > 0)
    .map((activity) => exerciseOf(activity.exerciseId))
    .filter((exercise) => exercise !== undefined);

  const muscles = highlight(
    worked.map((exercise) => exercise.primaryMuscleId).filter((id) => id !== null),
    worked.flatMap((exercise) => exercise.secondaryMuscleIds),
  );

  const plannedSets = plan?.exercises.reduce((total, entry) => total + entry.sets.length, 0) ?? 0;

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      className="flex-1 bg-background pb-3 dark:bg-background-dark"
    >
      <View className="px-5 pt-4">
        {/* La même page sert deux moments : le bilan d'une séance qu'on vient
            de finir, et la fiche d'une séance qu'on consulte. Le second a
            besoin d'une flèche, le premier d'un point final -- et ce point
            final n'est pas un retour : la séance n'existe plus derrière. */}
        <BackHeader
          title={fresh ? 'Séance terminée' : plan ? plan.name : 'Séance libre'}
          subtitle={
            fresh
              ? `${plan ? plan.name : 'Séance libre'} · ${formatDateTime(summary.session.startedAt)}`
              : formatDateTime(summary.session.startedAt)
          }
          onBack={() => (fresh ? router.replace('/home') : router.back())}
          onMenu={() => setSheet('menu')}
        />
      </View>

      <ScrollView
        contentContainerClassName="gap-4 px-5 pb-8"
        keyboardShouldPersistTaps="handled"
      >
        {/* Les trois chiffres qu'on retient d'une séance. */}
        <View className="flex-row gap-3">
          <Figure value={summary.duration === null ? '—' : formatClock(summary.duration)} label="durée" />
          <Figure value={String(worked.length)} label={worked.length > 1 ? 'exercices' : 'exercice'} />
          <Figure
            value={
              plannedSets > 0
                ? `${summary.completedSetCount}/${plannedSets}`
                : String(summary.completedSetCount)
            }
            label={plannedSets > 0 ? 'séries prévues' : 'séries'}
          />
        </View>

        {/* Ce qu'on a travaillé, sans avoir à relire la liste des exercices. */}
        {worked.length > 0 && (
          <Card density="titled" className="items-center gap-2">
            <Text className="self-start font-bold uppercase text-label text-muted dark:text-muted-dark">
              Travaillé
            </Text>
            <BodyMap parts={muscles} scale={0.62} />
          </Card>
        )}

        {/* Ce qu'une séance vient de mettre à portée : proposé, jamais
            appliqué d'office (n°17). */}
        {reached.length > 0 && (
          <View className="gap-2">
            <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
              {reached.length > 1 ? 'Étapes atteintes' : 'Étape atteinte'}
            </Text>
            {reached.map(({ goal, evaluation }) => (
              <View key={goal.id} className="gap-2">
                <GoalCard
                  goal={goal}
                  evaluation={evaluation}
                  subjectName={(entry) =>
                    entry.currentSubject.kind === 'exercise'
                      ? nameOf(entry.currentSubject.exerciseId)
                      : entry.currentSubject.metricId
                  }
                  unitOf={unitOf}
                  onPress={() => router.push({ pathname: '/goal', params: { id: goal.id } })}
                />
                {!goal.isOnLastStep && (
                  <Button
                    label="Passer à l étape suivante"
                    size="md"
                    onPress={() =>
                      advanceProgression(goal)
                        .then(() => notify('Étape franchie.', 'success'))
                        .then(reload)
                        .catch((e) => notify(messageOf(e)))
                    }
                  />
                )}
              </View>
            ))}
          </View>
        )}

        {/* Le détail, en texte : c'est un bilan qu'on relit, pas une saisie. */}
        <View className="gap-2">
          <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
            Ce que tu as fait
          </Text>

          {summary.activities.map((activity, index) => {
            const prevu = plan?.exercises.find(
              (entry) => entry.exerciseId === activity.exerciseId,
            )?.sets.length;

            return (
              <Card key={index} className="gap-1">
                {/* Trois gestes se disputaient cette carte : ouvrir
                    l'exercice, ajuster une série, voir sa vidéo -- trois
                    cibles voisines, dont une ligne de texte. Seul ce qu'on
                    fait SOUVENT reste direct : ouvrir l'exercice, et regarder
                    une vidéo. Corriger et supprimer passent par le menu, où
                    ils nomment la série qu'ils visent. */}
                <View className="flex-row items-start justify-between gap-2">
                  <Pressable
                    className="shrink"
                    onPress={() =>
                      router.push({ pathname: '/exercise', params: { id: activity.exerciseId } })
                    }
                  >
                    <Text
                      className="font-bold text-body text-ink dark:text-ink-dark"
                      numberOfLines={1}
                    >
                      {nameOf(activity.exerciseId)}
                    </Text>
                  </Pressable>

                  {activity.performanceId && activity.completedSets.length > 0 && (
                    <Pressable onPress={() => setActing(activity)} hitSlop={8}>
                      <Ionicons name="ellipsis-horizontal" size={18} color="#8B9086" />
                    </Pressable>
                  )}
                </View>

                {activity.completedSets.length === 0 ? (
                  <Text className="text-caption text-muted dark:text-muted-dark">
                    Aucune série validée.
                  </Text>
                ) : (
                  activity.completedSets.map(({ set, index: setIndex }, position) => (
                    <View key={position} className="flex-row items-center gap-2 py-0.5">
                      <Text
                        className="font-mono text-small text-muted dark:text-muted-dark"
                        style={{ fontVariant: ['tabular-nums'] }}
                      >
                        {position + 1}.  {formatSetValues(set.values, (m) => unitOf(m))}
                      </Text>
                      {set.videoUri && activity.performanceId && (
                        <VideoBadge
                          onPress={() =>
                            setWatching({
                              performanceId: activity.performanceId!,
                              setIndex,
                              name: set.videoUri!,
                            })
                          }
                        />
                      )}
                    </View>
                  ))
                )}

                {/* Le prévu ne se rappelle que s'il n'a pas été tenu : le
                    dire quand tout est fait n'apprendrait rien. */}
                {prevu !== undefined && activity.completedSets.length < prevu && (
                  <Text className="pt-0.5 font-mono text-small text-planned dark:text-planned-dark">
                    {activity.completedSets.length} sur {prevu} série{prevu > 1 ? 's' : ''} prévue
                    {prevu > 1 ? 's' : ''}
                  </Text>
                )}
              </Card>
            );
          })}
        </View>
      </ScrollView>

      {fresh && (
        <View className="px-5 pt-2">
          <Button label="Terminer" size="lg" onPress={() => router.replace('/home')} />
        </View>
      )}

      <Sheet
        visible={sheet === 'menu'}
        title={plan ? plan.name : 'Séance libre'}
        actions={[
          {
            label: 'Effacer cette séance',
            tone: 'danger',
            onPress: () => setSheet('confirm'),
          },
        ]}
        onClose={() => setSheet('none')}
      />

      {/* Une entrée par série, plutôt qu'un geste à viser sur la ligne :
          ici le doigt a de la place, et chaque action dit sur quoi elle
          porte. */}
      <Sheet
        visible={acting !== null}
        title={acting ? nameOf(acting.exerciseId) : ''}
        actions={(acting?.completedSets ?? []).flatMap(({ set, index: setIndex }, position) => [
          {
            label: `Ajuster la série ${position + 1}`,
            onPress: () =>
              setEditing({
                performanceId: acting!.performanceId!,
                // Le rang RÉEL dans la performance, abandons compris : le
                // résumé le fournit, et le recalculer désignerait de travers.
                setIndex,
                measurementIds: acting!.measurementIds,
                values: { ...set.values },
              }),
          },
          ...(set.videoUri
            ? [
                {
                  label: `Supprimer la vidéo de la série ${position + 1}`,
                  tone: 'danger' as const,
                  onPress: () =>
                    detachSetVideo(acting!.performanceId!, setIndex)
                      .then(reload)
                      .then(() => notify('Vidéo supprimée.', 'success'))
                      .catch((e) => notify(messageOf(e))),
                },
              ]
            : []),
        ])}
        onClose={() => setActing(null)}
      />

      <SetVideoViewer
        uri={watching ? fileUri(watching.name) : null}
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

      <Sheet
        visible={sheet === 'confirm'}
        title="Effacer cette séance ?"
        description="Ses performances disparaissent avec elle : elles ne compteront plus dans tes records ni dans tes objectifs. Rien ne permettra de revenir en arrière."
        actions={[
          {
            label: 'Effacer cette séance',
            tone: 'danger',
            onPress: () =>
              eraseSession(id)
                // Les captations de ses séries ne sont plus réclamées par
                // personne : la passe de ramassage les emporte, comme elle
                // emporte les démonstrations d'un exercice supprimé.
                .then(forgetUnusedMedia)
                .then(() => {
                  notify('Séance effacée.', 'success');
                  router.replace('/history');
                })
                .catch((e) => notify(messageOf(e))),
          },
        ]}
        onClose={() => setSheet('none')}
      />
    </SafeAreaView>
  );
}

/** Un chiffre et ce qu'il compte. */
function Figure({ value, label }: { value: string; label: string }) {
  return (
    <Card className="flex-1 items-center gap-0.5">
      <Text
        className="font-mono-bold text-heading text-ink dark:text-ink-dark"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>
      <Text className="text-caption text-muted dark:text-muted-dark" numberOfLines={1}>
        {label}
      </Text>
    </Card>
  );
}
