import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, Text, useColorScheme, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Exercise } from '../src/domain/exercise/exercise';
import type { Measurement } from '../src/domain/exercise/measurement';
import type { PlannedWorkout } from '../src/domain/planned-workout/planned-workout';
import { findAll as findAllExercises, findAllMeasurements } from '../src/infra/exercise-repository';
import { findAll as findAllPlans } from '../src/infra/planned-workout-repository';
import { BodyMap } from '../src/ui/body-map';
import { highlight } from '../src/ui/body-slugs';
import { Button } from '../src/ui/button';
import { Card } from '../src/ui/card';
import { formatClock, formatDateTime, formatDuration, isDuration } from '../src/ui/format';
import { GoalChecklist } from '../src/ui/goal-checklist';
import { messageOf } from '../src/ui/message';
import { useNotifications } from '../src/ui/notifications';
import { Sheet } from '../src/ui/sheet';
import { cn } from '../src/ui/cn';
import {
  compareToPlan,
  formatMeasure,
  formatSetValues,
  formatTargets,
  type PlanComparison,
} from '../src/ui/set-values';
import { SetVideoViewer, VideoBadge } from '../src/ui/set-video';
import { fileUri, forgetUnusedMedia, pickSessionPhoto } from '../src/use-cases/media-actions';
import { detachSetVideo } from '../src/use-cases/set-video';
import { attachSessionPhoto, detachSessionPhoto } from '../src/use-cases/session-photo';
import { advanceProgression, goalsReachedBy, type ReachedGoal } from '../src/use-cases/goal-actions';
import { eraseSession } from '../src/use-cases/erase-history';
import {
  findSessionRecords,
  findSessionSummary,
  type SessionRecord,
  type SessionSummary,
} from '../src/use-cases/session-summary';
import { feelRecord } from '../src/ui/haptics';
import { PALETTE } from '../src/ui/palette';
import { PhotoViewer } from '../src/ui/photo-viewer';
import { RecordsCard } from '../src/ui/records-card';
import { DetailContent, DetailFooter, DetailLayout } from '../src/ui/detail-layout';
import { SetIndex } from '../src/ui/set-index';

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
  const [records, setRecords] = useState<SessionRecord[]>([]);
  const [sheet, setSheet] = useState<'none' | 'menu' | 'confirm' | 'photo'>('none');
  /** La photo de la séance, ouverte en plein écran. */
  const [viewingPhoto, setViewingPhoto] = useState(false);
  /** La captation ouverte, et la série d'où elle vient. */
  const [watching, setWatching] = useState<{
    performanceId: string;
    setIndex: number;
    name: string;
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
    setRecords(found ? await findSessionRecords(found) : []);
  }, [id]);

  /**
   * Une vibration pour les records, une seule fois, et seulement au bilan
   * d'une séance qu'on VIENT de finir : relire une vieille séance ne fête
   * rien.
   */
  const celebrated = useRef(false);
  useEffect(() => {
    if (!fresh || celebrated.current || records.length === 0) return;
    celebrated.current = true;
    feelRecord();
  }, [fresh, records]);

  useFocusEffect(
    useCallback(() => {
      reload().catch((e) => notify(messageOf(e)));
    }, [reload]),
  );

  /**
   * Optionnelle, et jamais imposée au moment où l'on ferme l'écran : on peut
   * y penser une fois douché, bien après avoir quitté la séance.
   */
  function addPhoto() {
    pickSessionPhoto()
      .then((name) => (name ? attachSessionPhoto(id, name) : undefined))
      // Remplacée, l'ancienne n'est plus réclamée par personne.
      .then(forgetUnusedMedia)
      .then(reload)
      .catch((e) => notify(messageOf(e)));
  }

  function removePhoto() {
    detachSessionPhoto(id)
      .then(forgetUnusedMedia)
      .then(reload)
      .then(() => notify('Photo supprimée.', 'success'))
      .catch((e) => notify(messageOf(e)));
  }

  const exerciseOf = (exerciseId: string) => exercises.find((e) => e.id === exerciseId);
  const nameOf = (exerciseId: string) => exerciseOf(exerciseId)?.name ?? exerciseId;
  /** Le volume n'a pas d'unité : un indice, arrondi comme sur la fiche. */
  const showRecord = (measurementId: string | null, value: number) =>
    measurementId === null
      ? `${Math.round(value * 10) / 10}`
      : formatMeasure(value, unitOf(measurementId));

  const unitOf = (measurementId: string | null) =>
    measurementId === null
      ? ''
      : (measurements.find((m) => m.id === measurementId)?.unit ?? measurementId);

  if (!summary) {
    return (
      <DetailLayout title="Séance" onBack={() => router.back()}>
        <DetailContent>
          <Text className="text-muted dark:text-muted-dark">Séance introuvable.</Text>
        </DetailContent>
      </DetailLayout>
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
    <DetailLayout
      title={fresh ? 'Séance terminée' : plan ? plan.name : 'Séance libre'}
      subtitle={
        fresh
          ? `${plan ? plan.name : 'Séance libre'} · ${formatDateTime(summary.session.startedAt)}`
          : formatDateTime(summary.session.startedAt)
      }
      // La même page sert deux moments : le bilan d'une séance qu'on vient de
      // finir, et la fiche d'une séance qu'on consulte. Le second a besoin
      // d'une flèche, le premier d'un point final -- et ce point final n'est
      // pas un retour : la séance n'existe plus derrière.
      onBack={() => (fresh ? router.replace('/home') : router.back())}
      onMenu={() => setSheet('menu')}
    >
      <DetailContent>
        {/* Les trois chiffres qu'on retient d'une séance. */}
        <View className="flex-row gap-3">
          <Figure value={summary.duration === null ? '—' : formatClock(summary.duration)} label="Durée" />
          <Figure value={String(worked.length)} label={worked.length > 1 ? 'Exercices' : 'Exercice'} />
          <Figure
            value={
              plannedSets > 0
                ? `${summary.completedSetCount}/${plannedSets}`
                : String(summary.completedSetCount)
            }
            label={plannedSets > 0 ? 'Séries prévues' : 'Séries'}
          />
        </View>

        {/* Ce que cette séance a fait de mieux que toutes celles d'avant.
            Juste sous les chiffres : c'est la nouvelle qu'on vient chercher,
            avant la photo et le détail. */}
        {records.length > 0 && (
          <RecordsCard
            title={records.length > 1 ? `${records.length} nouveaux records` : 'Nouveau record'}
            rows={records.map((record) => ({
              key: `${record.exerciseId}-${record.measurementId ?? 'volume'}`,
              label: `${nameOf(record.exerciseId)}${record.measurementId === null ? ' · volume' : ''}`,
              from: showRecord(record.measurementId, record.previous),
              to: showRecord(record.measurementId, record.value),
            }))}
            celebrate={Boolean(fresh)}
          />
        )}

        {/* Un instantané, pas une mesure : optionnelle, elle ne vient jamais
            s'imposer entre les chiffres qu'on retient d'une séance. */}
        {/* La toucher l'ouvre en grand ; le crayon la remplace ou la retire.
            Toucher la photo pour la REMPLACER surprenait : on voulait la
            voir, et la galerie s'ouvrait. */}
        {summary.session.photoUri ? (
          <View>
            <Pressable onPress={() => setViewingPhoto(true)} accessibilityLabel="Voir la photo">
              <Image
                source={{ uri: fileUri(summary.session.photoUri) }}
                className="h-52 w-full rounded-2xl"
                resizeMode="cover"
              />
            </Pressable>
            <Pressable
              onPress={() => setSheet('photo')}
              hitSlop={8}
              accessibilityLabel="Modifier la photo"
              className="absolute right-2 top-2 h-9 w-9 items-center justify-center rounded-full bg-black/60 active:opacity-60"
            >
              <Ionicons name="pencil" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={addPhoto} className="py-1">
            <Text className="text-center text-lead text-primary-ink dark:text-primary-ink-dark">
              + Ajouter une photo
            </Text>
          </Pressable>
        )}

        {/* Ce qu'on a travaillé, sans avoir à relire la liste des exercices. */}
        {worked.length > 0 && (
          <Card density="titled" className="items-center gap-2">
            <Text className="self-start font-bold uppercase text-label text-muted dark:text-muted-dark">
              Travaillé
            </Text>
            <BodyMap parts={muscles} scale={0.62} done />
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
                {/* La même carte que sur l'accueil et dans la liste : un
                    objectif se reconnaît d'un écran à l'autre. */}
                <GoalChecklist
                  goal={goal}
                  evaluation={evaluation}
                  nameOf={(subject) =>
                    subject.kind === 'exercise' ? nameOf(subject.exerciseId) : subject.metricId
                  }
                  mediaOf={(subject) =>
                    subject.kind === 'exercise'
                      ? exerciseOf(subject.exerciseId)?.media.find((media) => media.kind === 'image')
                      : undefined
                  }
                  unitOf={unitOf}
                  onPress={() => router.push({ pathname: '/goal', params: { id: goal.id } })}
                />
                {!goal.isOnLastStep && (
                  <Button
                    label="Passer à l'étape suivante"
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
        <View className="gap-3">
          <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
            Ce que tu as fait
          </Text>

          {summary.activities.map((activity, index) => {
            const plannedExercise = plan?.exercises.find(
              (entry) => entry.exerciseId === activity.exerciseId,
            );
            const rows = Math.max(
              plannedExercise?.sets.length ?? 0,
              activity.completedSets.length,
            );
            // Celui pris en quittant l'exercice précédent : montré à part,
            // entre les cartes, plutôt que confondu avec les repos internes.
            const restBeforeActivity = activity.completedSets[0]?.restBefore ?? null;

            /**
             * Le temps d'exécution d'une série -- utile pour juger si un
             * rythme imposé (EMOM) est tenable, la vitesse d'exécution étant
             * un signal qu'aucune mesure déclarée ne porte.
             *
             * Pas affiché quand l'exercice mesure déjà une durée : la valeur
             * saisie EST alors ce temps, le répéter n'apprendrait rien de
             * plus. Même règle que sur la fiche de l'exercice.
             */
            const activityExercise = exerciseOf(activity.exerciseId);
            const showExecutionTime = activityExercise
              ? !activityExercise.measurementIds.some((measurementId) =>
                  isDuration(unitOf(measurementId)),
                )
              : false;
            const executionLabel = (set: { startedAt: Date; endedAt: Date | null }) =>
              showExecutionTime && set.endedAt
                ? formatDuration((set.endedAt.getTime() - set.startedAt.getTime()) / 1000)
                : null;

            return (
              <Fragment key={index}>
                {index > 0 && restBeforeActivity !== null && restBeforeActivity > 0 && (
                  <RestLine seconds={restBeforeActivity} />
                )}

                {/* La CARTE entière ouvre l'exercice, et pas son seul titre : on
                   vise une carte, pas une ligne de texte de treize pixels. La
                   pastille vidéo garde son tap -- un Pressable posé dans un
                   autre reçoit ce qui le touche.

                   La fiche se LIT : ouvrir l'exercice, regarder une vidéo.
                   Corriger appartient à l'écran de modification, où chaque
                   geste a la place qu'une ligne de série n'a pas. */}
                <Pressable
                  onPress={() =>
                    router.push({ pathname: '/exercise', params: { id: activity.exerciseId } })
                  }
                >
                  <Card>
                    {/* Un titre appelle sa propre respiration : le confondre
                        avec l'espace entre deux séries -- qui, lui, doit
                        rester serré pour lire la liste d'un coup d'oeil --
                        écrasait le nom de l'exercice contre sa première
                        ligne. */}
                    <Text
                      className="pb-3 font-extrabold text-lead text-ink dark:text-ink-dark"
                      numberOfLines={1}
                    >
                      {nameOf(activity.exerciseId)}
                    </Text>

                    {rows === 0 ? (
                      <Text className="text-caption text-muted dark:text-muted-dark">
                        Aucune série validée.
                      </Text>
                    ) : plannedExercise ? (
                      <View className="gap-2">
                        {/* Prévu à gauche, fait à droite : la même ligne dit
                            les deux, plutôt qu'une mention à part qui ne
                            revenait que pour signaler un manque. */}
                        {Array.from({ length: rows }, (_, position) => {
                          const plannedSet = plannedExercise.sets[position];
                          const done = activity.completedSets[position];
                          return (
                            <View key={position}>
                              {/* Celle d'avant l'exercice se montre déjà
                                  au-dessus de la carte : ne pas la répéter
                                  ici. */}
                              {position > 0 &&
                                done &&
                                done.restBefore !== null &&
                                done.restBefore > 0 && <RestLine seconds={done.restBefore} />}
                              <View className="flex-row items-center gap-3 rounded-lg bg-surface-alt px-3 py-2.5 dark:bg-surface-alt-dark">
                                <Text
                                  className="flex-1 text-left font-mono text-caption text-planned dark:text-planned-dark"
                                  numberOfLines={1}
                                >
                                  {plannedSet ? formatTargets(plannedSet.targets, unitOf) : '—'}
                                </Text>
                                <ComparisonGlyph
                                  status={compareToPlan(plannedSet?.targets, done?.set.values)}
                                />
                                <Text
                                  className="flex-1 text-right font-mono-bold text-body text-ink dark:text-ink-dark"
                                  numberOfLines={1}
                                >
                                  {done ? formatSetValues(done.set.values, unitOf) : '—'}
                                </Text>
                                {done && executionLabel(done.set) && (
                                  <Text className="shrink-0 font-mono text-micro text-muted dark:text-muted-dark">
                                    {executionLabel(done.set)}
                                  </Text>
                                )}
                                {done?.set.videoUri && activity.performanceId && (
                                  <VideoBadge
                                    onPress={() =>
                                      setWatching({
                                        performanceId: activity.performanceId!,
                                        setIndex: done.index,
                                        name: done.set.videoUri!,
                                      })
                                    }
                                  />
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      <View className="gap-2">
                        {activity.completedSets.map((done, position) => (
                          <View key={position}>
                            {position > 0 && done.restBefore !== null && done.restBefore > 0 && (
                              <RestLine seconds={done.restBefore} />
                            )}
                            <View className="flex-row items-center gap-2 rounded-lg bg-surface-alt px-3 py-2.5 dark:bg-surface-alt-dark">
                              <SetIndex index={position + 1} />
                              <Text
                                className="flex-1 font-mono-bold text-body text-ink dark:text-ink-dark"
                              >
                                {formatSetValues(done.set.values, unitOf)}
                              </Text>
                              {executionLabel(done.set) && (
                                <Text className="shrink-0 font-mono text-micro text-muted dark:text-muted-dark">
                                  {executionLabel(done.set)}
                                </Text>
                              )}
                              {done.set.videoUri && activity.performanceId && (
                                <VideoBadge
                                  onPress={() =>
                                    setWatching({
                                      performanceId: activity.performanceId!,
                                      setIndex: done.index,
                                      name: done.set.videoUri!,
                                    })
                                  }
                                />
                              )}
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </Card>
                </Pressable>
              </Fragment>
            );
          })}
        </View>
      </DetailContent>

      {fresh && (
        <DetailFooter>
          <Button label="Terminer" size="lg" onPress={() => router.replace('/home')} />
        </DetailFooter>
      )}

      <Sheet
        visible={sheet === 'menu'}
        title={plan ? plan.name : 'Séance libre'}
        actions={[
          {
            label: 'Modifier cette séance',
            icon: 'create-outline',
            onPress: () => router.push({ pathname: '/edit-session', params: { id } }),
          },
          {
            label: 'Effacer cette séance',
            icon: 'trash-outline',
            tone: 'danger',
            onPress: () => setSheet('confirm'),
          },
        ]}
        onClose={() => setSheet('none')}
      />

      <Sheet
        visible={sheet === 'photo'}
        title="Photo de la séance"
        actions={[
          { label: 'Remplacer la photo', icon: 'images-outline', onPress: addPhoto },
          {
            label: 'Supprimer la photo',
            icon: 'trash-outline',
            tone: 'danger',
            onPress: removePhoto,
          },
        ]}
        onClose={() => setSheet('none')}
      />

      <PhotoViewer
        uri={viewingPhoto && summary.session.photoUri ? fileUri(summary.session.photoUri) : null}
        onClose={() => setViewingPhoto(false)}
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
        visible={sheet === 'confirm'}
        title="Effacer cette séance ?"
        description="Ses performances disparaissent avec elle : elles ne compteront plus dans tes records ni dans tes objectifs. Rien ne permettra de revenir en arrière."
        actions={[
          {
            label: 'Effacer cette séance',
            icon: 'trash-outline',
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
    </DetailLayout>
  );
}

/** Le repos pris avant la ligne qui suit -- entre deux séries, ou deux exercices. */
/**
 * Le repos entre deux lignes, comme une coupure sur une frise : un trait, le
 * temps, un trait -- pas un texte au milieu des séries qu'il sépare.
 */
function RestLine({ seconds }: { seconds: number }) {
  return (
    <View className="items-center py-1.5">
      <View className="h-2 w-px bg-border-strong dark:bg-border-strong-dark" />
      <Text className="py-0.5 font-mono text-micro text-muted dark:text-muted-dark">
        {formatDuration(seconds)}
      </Text>
      <View className="h-2 w-px bg-border-strong dark:bg-border-strong-dark" />
    </View>
  );
}

const COMPARISON_GLYPHS: Record<PlanComparison, string> = {
  above: '↑',
  'on-target': '=',
  below: '↓',
};

/**
 * Ce qu'une série dit par rapport à ce qui était prévu, entre les deux
 * colonnes qu'elle compare : un symbole suffit à sa place, une étiquette n'y
 * apprendrait rien de plus.
 */
function ComparisonGlyph({ status }: { status: PlanComparison }) {
  return (
    <Text
      className={cn(
        'shrink-0 text-center font-mono-bold text-body',
        status === 'above' && 'text-success dark:text-success-dark',
        status === 'below' && 'text-danger dark:text-danger-dark',
        status === 'on-target' && 'text-muted dark:text-muted-dark',
      )}
      style={{ width: 16 }}
    >
      {COMPARISON_GLYPHS[status]}
    </Text>
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
