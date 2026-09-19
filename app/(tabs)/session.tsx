import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useNotifications } from '../../src/ui/notifications';
import { messageOf } from '../../src/ui/message';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Exercise } from '../../src/domain/exercise/exercise';
import type { Measurement } from '../../src/domain/exercise/measurement';
import type { Muscle } from '../../src/domain/exercise/muscle';
import type {
  ExercisePerformance,
  Side,
  ValuesBySide,
} from '../../src/domain/performance/exercise-performance';
import type { PlannedWorkout, TargetValues } from '../../src/domain/planned-workout/planned-workout';
import type { WorkoutSession } from '../../src/domain/workout-session/workout-session';
import {
  findAll as findAllExercises,
  findAllMeasurements,
  findAllMuscles,
} from '../../src/infra/exercise-repository';
import {
  findById as findPerformanceById,
  findRecentExerciseIds,
} from '../../src/infra/performance-repository';
import { findAll as findAllPlans } from '../../src/infra/planned-workout-repository';
import type { ScheduledWorkout } from '../../src/domain/scheduling/scheduled-workout';
import {
  cancelScheduledWorkout,
  listSchedule,
  rescheduleWorkout,
  scheduleWorkout,
} from '../../src/use-cases/scheduling-actions';
import { findActive } from '../../src/infra/workout-session-repository';
import { Button } from '../../src/ui/button';
import { Card } from '../../src/ui/card';
import { DatePickerSheet } from '../../src/ui/date-picker';
import { EmptyState } from '../../src/ui/empty-state';
import { ExercisePicker } from '../../src/ui/exercise-picker';
import { catalogueSource } from '../../src/use-cases/repdb-actions';
import { BackHeader, SectionHeader, SessionHeader } from '../../src/ui/screen-header';
import { Sheet, type SheetAction } from '../../src/ui/sheet';
import { SetChip } from '../../src/ui/set-chip';
import { SlideIn } from '../../src/ui/slide-in';
import { playRoundCountdown, playRoundStart } from '../../src/ui/round-sound';
import { SET_ROW_GAP, SET_ROW_HEIGHT, SetRow, type SetRowStatus } from '../../src/ui/set-row';
import { MeasureField } from '../../src/ui/measure-field';
import { Timer } from '../../src/ui/timer';
import { CountdownRing } from '../../src/ui/countdown-ring';
import { EMOM_INTERVAL_SECONDS, emomStatus } from '../../src/domain/workout-session/emom';
import {
  formatEmomPace,
  formatSetValues,
  formatSetValuesShort,
  formatTargets,
  formatTargetsShort,
} from '../../src/ui/set-values';
import { formatDateTime, isDuration } from '../../src/ui/format';
import {
  abandonPerformanceSet,
  cancelWorkoutSession,
  completePerformanceSet,
  finishActivity,
  correctSet,
  finishWorkoutSession,
  goToNextExercise,
  goToPreviousExercise,
  startActivity,
  startPerformanceSet,
  startRest,
  beginWorkoutSession,
  startWorkoutSession,
  stopRest,
} from '../../src/use-cases/workout-session-actions';

import { defaultTargets } from '../../src/ui/set-defaults';
import { takeStoppedByHand } from '../../src/ui/filmed-set';
import { SetVideoViewer } from '../../src/ui/set-video';
import { fileUri } from '../../src/use-cases/media-actions';
import { detachSetVideo } from '../../src/use-cases/set-video';


export default function SessionScreen() {
  const { notify } = useNotifications();
  const router = useRouter();
  /**
   * L'entraînement qu'on s'apprête à faire, passé par l'écran d'où l'on vient.
   *
   * Il ne crée RIEN : une séance commence à sa première série, pas au moment
   * où on décide de s'y mettre. Sans cela, changer d'avis laissait derrière
   * soi une séance ouverte qu'il fallait annuler à la main.
   */
  const { plan: planParam, scheduled: scheduledParam } = useLocalSearchParams<{
    plan?: string;
    scheduled?: string;
  }>();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [performance, setPerformance] = useState<ExercisePerformance | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [muscles, setMuscles] = useState<Muscle[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [plans, setPlans] = useState<PlannedWorkout[]>([]);
  const [schedule, setSchedule] = useState<ScheduledWorkout[]>([]);
  /**
   * L'exercice choisi pour une séance libre, tant qu'elle n'a pas commencé.
   *
   * Il vit ICI et non en base : une séance date de sa première série, donc
   * choisir l'exercice ne doit encore rien écrire -- revenir en arrière ne
   * laisse aucune séance ouverte derrière soi.
   */
  const [pending, setPending] = useState<string | null>(null);
  /**
   * Ce que visera la PREMIÈRE série d'un exercice libre.
   *
   * Un exercice libre n'a pas de plan pour le dire : ces valeurs en tiennent
   * lieu. Elles partent des valeurs de départ, se règlent avant de commencer,
   * et survivent au démarrage -- c'est la série qui les porte ensuite.
   */
  const [freeTargets, setFreeTargets] = useState<Record<string, number> | null>(null);
  /** La première série ouverte au réglage, avant d'avoir commencé. */
  const [adjustingStart, setAdjustingStart] = useState(false);
  /** L'entraînement programmé qu'on est en train de déplacer. */
  const [moving, setMoving] = useState<ScheduledWorkout | null>(null);
  /** La programmation en cours : d'abord l'entraînement, puis sa date. */
  const [planning, setPlanning] = useState<{ plan: PlannedWorkout | null } | null>(null);
  const [values, setValues] = useState<ValuesBySide>({});
  // La série dont on ajuste les valeurs, ouverte en tapant sa ligne.
  const [editing, setEditing] = useState<number | null>(null);
  /** La captation ouverte, par son nom de fichier. */
  const [watching, setWatching] = useState<string | null>(null);
  /**
   * La série filmée attend d'être validée.
   *
   * Elle ne peut pas l'être au retour de la caméra : ce qu'une série vaut --
   * les cibles du plan, ou ce qu'on a ajusté -- n'est connu que d'ici, et
   * l'écran de captation ne le sait pas.
   */
  const [finishAfterFilm, setFinishAfterFilm] = useState(false);
  // Replié, les séries tiennent sur une ligne de pastilles ; déplié, on
  // retrouve la liste détaillée.
  const [showDetail, setShowDetail] = useState(true);
  const [sheet, setSheet] = useState<
    'none' | 'menu' | 'pending-menu' | 'confirm-cancel' | 'end-of-plan' | 'pick-exercise'
  >('none');
  /**
   * L'exercice en cours tourne sur un rythme imposé, pas au tien : un round
   * toutes les `intervalSeconds`, pendant `totalRounds` rounds.
   *
   * Deux origines, un seul moteur : réglé ici même pour une séance libre, ou
   * dicté par l'entraînement qui l'a prévu. Ce qui vit dans cet état, c'est
   * le DÉROULÉ en cours -- les rounds ajoutés en chemin, l'arrêt anticipé --
   * et cela ne remonte jamais dans le plan : ce qui était prévu ne change pas
   * parce qu'un jour on s'est arrêté plus tôt (§2).
   */
  const [emom, setEmom] = useState<Emom | null>(null);
  /** La feuille qui règle durée totale et cible avant de démarrer en EMOM. */
  const [configuringEmom, setConfiguringEmom] = useState(false);
  const [emomTotalSeconds, setEmomTotalSeconds] = useState(600);
  /** Empêche l'avance automatique de se déclencher deux fois pour le même round. */
  const advancingEmomRound = useRef(false);
  /**
   * La performance dont on a ARRÊTÉ l'EMOM en cours de route.
   *
   * Le plan, lui, dit toujours la même chose : sans cette mémoire, l'écran
   * reproposerait de démarrer le rythme à la seconde où on vient de l'arrêter.
   * Une performance = un exercice en cours, donc passer au suivant redonne la
   * main au plan.
   */
  const [emomStoppedFor, setEmomStoppedFor] = useState<string | null>(null);
  /**
   * Par où entre le prochain exercice.
   *
   * Depuis la droite en avançant, depuis la gauche en revenant : le sens du
   * mouvement dit lequel des deux gestes on vient de faire, ce qu'un fondu
   * seul ne dirait pas.
   */
  const [comingFrom, setComingFrom] = useState<'right' | 'left'>('right');
  /** Le rang du round déjà annoncé au son : on ne sonne pas deux fois. */
  const soundedRound = useRef(0);
  /** La seconde du décompte déjà sonnée, pour la même raison. */
  const soundedSecond = useRef<number | null>(null);

  const reload = useCallback(async () => {
    const [active, allExercises, allPlans, allMeasurements, allSchedule, allMuscles, recent] =
      await Promise.all([
        findActive(),
        findAllExercises(),
        findAllPlans(),
        findAllMeasurements(),
        listSchedule(),
        findAllMuscles(),
        findRecentExerciseIds(),
      ]);
    setSession(active);
    setExercises(allExercises);
    setPlans(allPlans);
    setMeasurements(allMeasurements);
    setMuscles(allMuscles);
    setRecentIds(recent);
    // Seules les intentions encore ouvertes intéressent l'écran.
    setSchedule(allSchedule.filter((entry) => entry.status === 'SCHEDULED'));

    const performanceId = active?.currentActivity?.performanceId ?? null;
    setPerformance(performanceId ? await findPerformanceById(performanceId) : null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload().catch((e) => notify(messageOf(e)));

      // Couper l'enregistrement, c'est dire qu'on a fini la série : on ne
      // s'arrête pas de filmer au milieu d'un mouvement.
      if (takeStoppedByHand()) setFinishAfterFilm(true);

      // Un exercice choisi et non démarré n'engage rien, et n'a donc pas à
      // survivre au départ de l'écran : revenir sur les séances repart de
      // zéro plutôt que de reprendre une intention qu'on avait laissée.
      // Les valeurs réglées, elles, restent : la série en cours les porte
      // encore, et changer d'exercice les remplace de toute façon.
      return () => {
        setPending(null);
        setAdjustingStart(false);
        setConfiguringEmom(false);
      };
    }, [reload]),
  );

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
      await reload();
    } catch (e) {
      notify(messageOf(e));
    }
  }

  const catalogue = useMemo(
    () =>
      catalogueSource(() => {
        reload().catch((e) => notify(messageOf(e)));
      }),
    [reload],
  );

  const plan = plans.find((p) => p.id === session?.plannedWorkoutId);
  const activity = session?.currentActivity;
  const plannedExercise =
    activity?.plannedPosition != null ? plan?.exercises[activity.plannedPosition] : undefined;

  const sets = performance?.sets ?? [];
  const nextSetIndex = sets.length;
  const lastSetIndex = nextSetIndex - 1;
  const lastSet = lastSetIndex >= 0 ? sets[lastSetIndex] : undefined;
  const resting = Boolean(session?.currentRest);
  const completedCount = sets.filter((set) => set.status === 'COMPLETED').length;
  // Toutes les séries prévues sont faites : la suivante serait une série en
  // plus du plan. Un exercice hors programme est dans ce cas dès le départ.
  const plannedDone = !plannedExercise || nextSetIndex >= plannedExercise.sets.length;
  // Reste-t-il un exercice après celui-ci dans le programme ?
  const hasNextExercise =
    activity?.plannedPosition != null &&
    plan !== undefined &&
    activity.plannedPosition + 1 < plan.exercises.length;
  const totalSets = Math.max(sets.length, plannedExercise?.sets.length ?? 0);

  // Un rendu par seconde, et seulement pendant le repos.
  const restStartedAt = session?.currentRest?.startedAt.getTime() ?? null;
  const [, setTick] = useState(0);
  useEffect(() => {
    if (restStartedAt === null && !emom) return;
    // Quatre fois par seconde pendant un EMOM : le décompte sonore se déclenche
    // sur ce qu'affiche l'écran, et une seconde jamais rendue -- le battement
    // n'est pas calé sur celui de l'horloge -- serait un bip qui saute.
    const interval = setInterval(() => setTick((value) => value + 1), emom ? 250 : 1000);
    return () => clearInterval(interval);
  }, [restStartedAt, emom]);
  const restElapsed = restStartedAt === null ? 0 : Math.floor((Date.now() - restStartedAt) / 1000);

  const unitOf = (id: string) => measurements.find((m) => m.id === id)?.unit ?? id;
  const nameOf = (id: string) => exercises.find((e) => e.id === id)?.name ?? id;
  const format = (v: ValuesBySide) => formatSetValues(v, unitOf);
  const formatShort = (v: ValuesBySide) => formatSetValuesShort(v, unitOf);
  const formatPlanned = (t: TargetValues) => formatTargets(t, unitOf);
  const formatPlannedShort = (t: TargetValues) => formatTargetsShort(t, unitOf);

  /**
   * Les côtés à saisir. Un exercice unilatéral en a deux : c'est UNE série
   * qui porte les deux, pas deux séries (§4).
   */
  const currentExercise = exercises.find((e) => e.id === activity?.exerciseId);
  const sides: Side[] = currentExercise?.isUnilateral ? ['LEFT', 'RIGHT'] : ['BOTH'];
  const SIDE_LABELS: Record<string, string> = {
    BOTH: '',
    LEFT: 'Côté gauche',
    RIGHT: 'Côté droit',
  };

  /** Les mêmes cibles s'appliquent à chaque côté : le plan ne les distingue pas. */
  const spreadOverSides = (targets: Record<string, number>): ValuesBySide =>
    Object.fromEntries(sides.map((side) => [side, targets]));

  /**
   * Le socle de ce qu'on affiche : pendant une série, ce que le plan prévoit
   * pour elle ; pendant le repos, ce qui a été enregistré. La saisie locale ne
   * fait que le recouvrir, le temps que l'écriture aboutisse.
   */
  function baseline(): ValuesBySide {
    if (!performance?.currentSet) return lastSet?.values ?? {};

    const targets = plannedExercise?.sets[sets.length - 1]?.targets;
    if (targets && Object.keys(targets).length > 0) return spreadOverSides(targets);

    // Hors programme : on reprend la dernière série faite, sinon ce qui a été
    // réglé avant de commencer -- un zéro demanderait de tout saisir.
    const previous = [...sets].reverse().find((set) => set.status === 'COMPLETED');
    return (
      previous?.values ??
      spreadOverSides(freeTargets ?? defaultTargets(performance.measurementIds ?? []))
    );
  }

  // La série en cours n'est plus recouverte par la saisie locale : celle-ci
  // appartient désormais à la série ouverte à l'ajustement, qui est une autre.
  const shown = baseline();

  /**
   * Le round EN COURS -- IN_PROGRESS ou déjà noté -- compte pour le rang :
   * `sets` inclut toujours la série ouverte, comme le veut la performance.
   */
  const setStartedAt = performance?.currentSet?.startedAt ?? lastSet?.startedAt ?? null;
  /**
   * Quand la fenêtre du round en cours a commencé.
   *
   * Celle de la série, sauf si une pause est passée par là : reprendre replace
   * le départ de manière à retrouver le temps qu'il restait, sans toucher à la
   * série elle-même -- elle a bien commencé quand elle a commencé, et
   * l'historique ne se réécrit pas pour une pause (§2).
   */
  const emomRoundStartedAt = emom?.windowStartedAt ?? setStartedAt;
  const emomState =
    emom && emomRoundStartedAt
      ? emomStatus({
          intervalSeconds: emom.intervalSeconds,
          totalRounds: emom.totalRounds,
          round: sets.length,
          roundStartedAt: emomRoundStartedAt,
          // En pause, l'horloge de l'écran s'arrête à l'instant du tap :
          // l'anneau se fige, et rien ne s'écoule tant qu'on n'a pas repris.
          now: emom.pausedAt ?? new Date(),
        })
      : null;
  // Celui prévu au départ, pas un maximum : "Ajouter un round" le recule.
  const isFinalEmomRound = Boolean(emom && sets.length >= emom.totalRounds);
  /**
   * L'écran doit-il proposer d'entrer dans le rythme prévu ?
   *
   * Tant que le plan a des rounds à faire, qu'aucun ne tourne, et qu'on ne
   * vient pas justement d'arrêter l'EMOM de cet exercice-là.
   */
  const emomOffered =
    Boolean(plannedExercise?.intervalSeconds) &&
    !emom &&
    !plannedDone &&
    emomStoppedFor !== activity?.performanceId;

  /**
   * L'avance automatique : l'horloge décide, jamais l'utilisateur (§ décision
   * prise en conversation). Si le round est encore en cours quand le temps
   * est écoulé, il est noté avec ce qui s'affiche à l'écran -- jamais
   * bloquant -- puis le suivant démarre aussitôt.
   *
   * SAUF sur le dernier round prévu : le laisser trancher tout seul, une
   * fois la minute écoulée, redonnait l'impression que l'EMOM "redémarrait"
   * sans prévenir. Le choix -- ajouter un round ou arrêter -- se fait donc
   * au tap sur "Fini", pas en silence à la fin du minuteur.
   */
  useEffect(() => {
    if (!emom || !emomState?.roundElapsed || isFinalEmomRound || advancingEmomRound.current) {
      return;
    }
    advancingEmomRound.current = true;

    run(async () => {
      if (performance?.currentSet) await completePerformanceSet(shown);
      await startPerformanceSet();
      // Le round suivant part de SA série : ce qu'une pause avait décalé ne
      // vaut que pour la fenêtre qu'elle a interrompue.
      setEmom((current) => (current ? { ...current, windowStartedAt: null } : current));
    }).finally(() => {
      advancingEmomRound.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emom, emomState?.roundElapsed, isFinalEmomRound]);

  /**
   * Le signal sonore du départ d'un round.
   *
   * Sur le NOMBRE de rounds et non sur chacun des chemins qui en démarrent un
   * -- l'avance automatique, « round suivant », le premier tour --, parce
   * qu'ils finissent tous là : une série de plus dans la performance. Un
   * chemin de plus demain sonnera sans qu'on y pense.
   */
  useEffect(() => {
    const round = sets.length;
    if (!emom || round === 0 || round === soundedRound.current) {
      soundedRound.current = round;
      return;
    }
    soundedRound.current = round;
    playRoundStart();
  }, [emom, sets.length]);

  /**
   * Les cinq dernières secondes du round, une par une.
   *
   * Le zéro n'est pas sonné ici : c'est le départ du round suivant qui le
   * dit, avec son propre signal -- deux sons au même instant n'en feraient
   * qu'un, brouillon.
   *
   * En pause, rien ne s'écoule : rien ne sonne non plus.
   */
  useEffect(() => {
    const left = emomState?.remainingSeconds;
    if (!emom || emom.pausedAt || left === undefined || left > 5 || left <= 0) {
      soundedSecond.current = null;
      return;
    }
    if (left === soundedSecond.current) return;
    soundedSecond.current = left;
    playRoundCountdown();
  }, [emom, emomState?.remainingSeconds]);

  /**
   * Suspendre le rythme, et le reprendre là où il en était.
   *
   * On ne met pas l'horloge en pause -- elle ne s'arrête pas --, on décale le
   * départ de la fenêtre en cours de tout le temps passé en pause. Reprendre
   * avec vingt secondes au compteur rend donc vingt secondes, pas une minute
   * entière.
   */
  function toggleEmomPause() {
    setEmom((current) => {
      if (!current) return current;
      if (!current.pausedAt) return { ...current, pausedAt: new Date() };

      const paused = Date.now() - current.pausedAt.getTime();
      const startedAt = emomRoundStartedAt;
      return {
        ...current,
        pausedAt: null,
        windowStartedAt: startedAt ? new Date(startedAt.getTime() + paused) : null,
      };
    });
  }

  /**
   * Partir sur le round suivant sans attendre la minute.
   *
   * L'horloge ne se double pas d'une avance manuelle : elle REPART. Le round
   * qui démarre a sa minute pleine, comme si la précédente s'était écoulée --
   * ce que dit d'ailleurs l'anneau, qui repart d'un tour complet. Une pause en
   * cours n'a plus lieu d'être : on vient de reprendre, et bien plus tôt.
   */
  function startNextRound() {
    run(async () => {
      closeEditing();
      await startPerformanceSet();
      setEmom((current) =>
        current ? { ...current, pausedAt: null, windowStartedAt: null } : current,
      );
    });
  }

  /**
   * Un round de plus que prévu : le dernier round ne l'était donc pas.
   *
   * Ne démarre RIEN tout de suite : on est dans la pause du round qui vient
   * de se terminer, et cette pause continue jusqu'à la minute pleine --
   * l'avance automatique (déjà en place pour tout round non-final) prendra
   * le relais au bon moment, maintenant que celui-ci n'est plus le dernier.
   */
  function addEmomRound() {
    if (!emom) return;
    setEmom({ ...emom, totalRounds: emom.totalRounds + 1 });
  }

  /**
   * La série n'a-t-elle qu'une durée à régler ?
   *
   * Alors taper la série ouvre directement sa roulette, et la refermer
   * relâche la série : s'arrêter sur le champ, avant comme après,
   * demanderait un tap pour rien.
   *
   * Dès qu'une autre mesure ou un second côté existe, les deux tombent. Il y
   * a un choix à faire avant, que l'ouverture d'office cacherait -- et un
   * réglage qui reste après, que la fermeture emporterait.
   */
  const durationOnly =
    sides.length === 1 &&
    (performance?.measurementIds ?? []).length === 1 &&
    isDuration(unitOf(performance!.measurementIds[0]));

  /**
   * Valider la série qu'on vient de filmer.
   *
   * À part de l'effet de focus, qui est figé à sa création : ici les valeurs
   * sont celles du rendu courant, donc celles que « Terminer » aurait
   * écrites. On attend d'ailleurs que la série en cours soit là -- le retour
   * de la caméra précède le rechargement.
   */
  useEffect(() => {
    if (!finishAfterFilm || !performance?.currentSet) return;
    setFinishAfterFilm(false);
    run(() => completePerformanceSet(shown));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishAfterFilm, performance]);

  /** Les valeurs de la série ouverte, recouvertes par la saisie en cours. */
  const editedSet = editing !== null ? sets[editing] : undefined;
  const editedValues = { ...(editedSet?.values ?? {}), ...values };

  /**
   * Ouvrir la caméra sur une série, par son rang.
   *
   * Le rang est fixé au départ de l'enregistrement, et la vidéo s'attache à
   * son arrêt : filmer le round À VENIR est donc possible -- il aura commencé
   * entre-temps, l'horloge s'en charge.
   */
  function film(setIndex: number) {
    if (!activity?.performanceId) return;
    router.push({
      pathname: '/record',
      params: { performance: activity.performanceId, set: String(setIndex) },
    });
  }

  /** Ajuster une valeur l'enregistre aussitôt sur la série ouverte. */
  function adjust(side: Side, measurementId: string, value: number) {
    if (editing === null) return;
    const next = {
      ...editedValues,
      [side]: { ...(editedValues[side] ?? {}), [measurementId]: value },
    };
    setValues(next);
    correctSet(editing, next).catch((e) => notify(messageOf(e)));
  }

  /**
   * Les champs qui règlent la série ouverte, côté par côté.
   *
   * Écrits une fois pour deux emplacements : sous le chrono quand l'écran a
   * la place, dans une feuille pendant un EMOM où l'anneau la prend toute.
   * Ce qu'on règle ne change pas d'un cas à l'autre -- seul l'endroit change.
   */
  function setControls() {
    return sides.map((side) => (
      <View key={side} className="gap-1">
        {SIDE_LABELS[side] ? (
          <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
            {SIDE_LABELS[side]}
          </Text>
        ) : null}
        <View className="flex-row gap-3">
          {(performance?.measurementIds ?? []).map((id) => (
            <MeasureField
              key={id}
              unit={unitOf(id)}
              measurementId={id}
              value={editedValues[side]?.[id] ?? 0}
              onChange={(value) => adjust(side, id, value)}
              // Les deux suivent la MÊME condition : la roulette n'est tout
              // le réglage que si elle est le seul. À plusieurs mesures, elle
              // en est une parmi d'autres, et la refermer ramène aux autres
              // au lieu de tout relâcher.
              autoOpen={durationOnly}
              onDone={durationOnly ? () => editing !== null && toggleEditing(editing) : undefined}
            />
          ))}
        </View>
      </View>
    ));
  }

  /**
   * Ouvre l'ajustement d'une série, le déplace, ou le referme.
   *
   * On relit AVANT de bouger, et non après. Les valeurs ont bien été écrites
   * à chaque pas, mais la copie gardée en mémoire date d'avant : bouger
   * d'abord ferait relire cette copie à la série qu'on quitte, le temps que
   * la lecture aboutisse -- soit un clignotement de l'ancienne valeur.
   *
   * Tant que la relecture n'a pas abouti, rien ne change à l'écran : la série
   * ouverte le reste, avec ce qu'on vient d'y régler.
   */
  function toggleEditing(index: number) {
    const next = editing === index ? null : index;
    reload()
      .then(() => {
        setValues({});
        setEditing(next);
      })
      .catch((e) => notify(messageOf(e)));
  }

  function closeEditing() {
    setEditing(null);
    setValues({});
  }

  function beginSet() {
    // Aucune valeur à mémoriser : le socle les fournit, la saisie locale
    // repart donc de zéro à chaque série.
    run(async () => {
      closeEditing();
      await startPerformanceSet();
    });
  }

  /**
   * Passer à l'exercice suivant enchaîne directement sur sa première série :
   * le repos en cours est interrompu par le démarrage de la série (§13).
   */
  function nextExercise() {
    // Dernier exercice du programme : plutôt que d'échouer sur un exercice
    // qui n'existe pas, on demande ce qu'on fait de la séance.
    if (!hasNextExercise) {
      setSheet('end-of-plan');
      return;
    }
    setComingFrom('right');
    setEmom(null);
    run(async () => {
      closeEditing();
      await goToNextExercise();
    });
  }

  /**
   * Entrer dans le rythme que l'entraînement a prévu pour cet exercice.
   *
   * Un geste explicite, et non une bascule automatique à l'arrivée sur
   * l'exercice : le round se compte à partir d'une série COMMENCÉE, et rien
   * ne dit qu'on est prêt à s'y mettre à la seconde où l'écran s'affiche.
   *
   * Si une série est déjà ouverte -- la première d'un entraînement naît avec
   * la séance --, on l'adopte comme premier round au lieu d'en ouvrir une
   * seconde : elle a commencé quand on a commencé, et c'est de là que part
   * l'horloge.
   *
   * Sauf si elle traîne depuis plus longtemps qu'un round : l'adopter la
   * noterait comme faite dans la seconde, une série qu'on n'a jamais
   * exécutée. Celle-là est abandonnée -- c'est bien ce qui lui est arrivé --
   * et le premier round part de maintenant.
   */
  function startPlannedEmom() {
    const interval = plannedExercise?.intervalSeconds;
    const totalRounds = Math.max(1, plannedExercise?.sets.length ?? 1);
    if (!interval) return;

    const openedAt = performance?.currentSet?.startedAt;
    const stale = openedAt ? Date.now() - openedAt.getTime() >= interval * 1000 : false;

    run(async () => {
      closeEditing();
      if (stale) await abandonPerformanceSet();
      if (!performance?.currentSet || stale) await startPerformanceSet();
      setEmom({ intervalSeconds: interval, totalRounds, pausedAt: null, windowStartedAt: null });
    });
  }

  /**
   * Arrêter le rythme.
   *
   * Dans un entraînement prévu, l'exercice s'arrête AVEC lui : un EMOM n'est
   * pas une manière de faire des séries, c'est ce que cet exercice est. Dire
   * qu'on arrête, c'est dire qu'on en a fini -- on enchaîne donc sur le
   * suivant, exactement comme la dernière série d'un exercice ordinaire. S'il
   * n'y a pas de suivant, `nextExercise` demande ce qu'on fait de la séance.
   *
   * En séance libre, il n'y a rien derrière : l'écran retrouve son chrono, et
   * la mémoire de l'arrêt évite de reproposer aussitôt ce qu'on vient de
   * quitter.
   */
  function stopEmom() {
    setEmom(null);
    setEmomStoppedFor(activity?.performanceId ?? null);
    if (plannedExercise?.intervalSeconds) nextExercise();
  }

  /**
   * Rattrape un "Suivant" pressé par erreur : tant qu'aucune série n'a été
   * faite sur l'exercice en cours, revenir en arrière ne perd rien.
   */
  function previousExercise() {
    setComingFrom('left');
    setEmom(null);
    run(async () => {
      closeEditing();
      await goToPreviousExercise();
    });
  }

  /**
   * Démarre un exercice hors programme. Comme pour l'exercice suivant, la
   * première série reste un geste explicite.
   */
  function addExercise(exerciseId: string) {
    // Un autre exercice, d'autres mesures : les valeurs réglées pour le
    // précédent ne veulent plus rien dire.
    setComingFrom('right');
    setFreeTargets(null);
    setEmom(null);
    run(async () => {
      closeEditing();
      if (activity) await finishActivity();
      await startActivity(exerciseId);
    });
  }

  /**
   * Retenir l'exercice choisi pour une séance libre.
   *
   * On RECHARGE avant de basculer : adopter depuis le catalogue vient de
   * créer l'exercice, et la liste locale ne le connaît pas encore. Sans cela
   * on affichait un exercice sans mesures, donc une série sans valeurs.
   *
   * Rien n'est calculé ici : les cibles se déduisent de l'exercice au moment
   * de l'afficher, et ne se figent qu'une fois réglées à la main.
   */
  function choose(exerciseId: string) {
    setFreeTargets(null);
    setAdjustingStart(false);
    setConfiguringEmom(false);
    reload()
      .then(() => setPending(exerciseId))
      .catch((e) => notify(messageOf(e)));
  }

  /**
   * Terminer la séance, puis annoncer ce qu'elle vient de mettre à portée.
   *
   * L'annonce vient APRÈS la clôture : les séries prévues et non faites y
   * sont abandonnées, et une étape ne doit pas se juger sur un état que la
   * séance n'a pas fini de quitter.
   */
  function finish() {
    // L'identifiant se lit AVANT de terminer : après, il n'y a plus de séance
    // active à interroger.
    const finished = session?.id;
    setEmom(null);
    run(async () => {
      await finishWorkoutSession();
      if (finished) router.replace({ pathname: '/session-summary', params: { id: finished, fresh: '1' } });
    });
  }

  /**
   * Commencer une séance libre pour de bon : la séance, l'exercice et sa
   * première série naissent du même geste, celui du bouton.
   */
  function beginFree(exerciseId: string) {
    startWorkoutSession()
      .then(() => startActivity(exerciseId))
      .then(() => startPerformanceSet())
      .then(reload)
      // L'exercice choisi ne se libère qu'une fois la séance À L'ÉCRAN. Le
      // libérer plus tôt ne laisserait plus rien pour tenir le palier, et
      // l'écran des séances s'afficherait entre les deux, le temps d'une
      // image.
      .then(() => {
        setPending(null);
        setAdjustingStart(false);
      })
      .catch((e) => notify(messageOf(e)));
  }

  /**
   * Démarrer en EMOM : la même naissance qu'une séance libre, mais le nombre
   * de rounds se déduit de la durée totale plutôt que de rester ouvert.
   */
  function beginFreeEmom(exerciseId: string, totalSeconds: number) {
    const totalRounds = Math.max(1, Math.round(totalSeconds / EMOM_INTERVAL_SECONDS));
    startWorkoutSession()
      .then(() => startActivity(exerciseId))
      .then(() => startPerformanceSet())
      .then(reload)
      .then(() => {
        setPending(null);
        setAdjustingStart(false);
        setConfiguringEmom(false);
        setEmom({
          intervalSeconds: EMOM_INTERVAL_SECONDS,
          totalRounds,
          pausedAt: null,
          windowStartedAt: null,
        });
      })
      .catch((e) => notify(messageOf(e)));
  }

  /**
   * Le sélecteur d'exercice, servi par les deux entrées qui y mènent : le
   * début d'une séance libre, et l'ajout d'un exercice en cours de séance.
   * Seule la suite diffère, donc seul l'appelant la fournit.
   *
   * Un seul exercice à la fois : la séance n'en travaille qu'un, et rien ne
   * garde ceux qu'on aurait choisis pour plus tard. On ne propose que les
   * exercices encore au catalogue.
   */
  const exercisePicker = (onPick: (exerciseId: string) => void) => (
    <ExercisePicker
      // Adopter depuis le catalogue crée un exercice : la liste locale doit
      // en tenir compte tout de suite.
      catalogue={catalogue}
      onCreate={(name) => router.push({ pathname: '/new-exercise', params: { name } })}
      onOpenSettings={() => {
        setSheet('none');
        router.push('/settings');
      }}
      visible={sheet === 'pick-exercise'}
      mode="single"
      title="Choisir un exercice"
      exercises={exercises.filter((exercise) => !exercise.isArchived)}
      muscles={muscles}
      recentIds={recentIds}
      onConfirm={(ids) => onPick(ids[0])}
      onClose={() => setSheet('none')}
    />
  );

  const menuActions: SheetAction[] = [
    { label: 'Terminer la séance', onPress: finish },
    ...(performance?.currentSet
      ? [{ label: 'Abandonner la série', onPress: () => run(abandonPerformanceSet) }]
      : []),
    ...(activity ? [{ label: "Passer à l'exercice suivant", onPress: nextExercise }] : []),
    // Uniquement tant que rien n'a encore été fait sur l'exercice en cours :
    // passé la première série, revenir en arrière perdrait ce qui vient
    // d'être fait plutôt que de simplement rattraper le clic de trop.
    ...(activity && session?.previousActivity && performance?.sets.length === 0
      ? [{ label: "Revenir à l'exercice précédent", onPress: previousExercise }]
      : []),
    // Le repos s'enchaîne tout seul après une série ; ici on le commande à
    // la main, pour souffler avant d'attaquer ou pour couper court.
    ...(session?.currentRest
      ? [{ label: 'Arrêter le repos', onPress: () => run(stopRest) }]
      : [{ label: 'Démarrer un repos', onPress: () => run(startRest) }]),
    { label: 'Annuler la séance', tone: 'danger' as const, onPress: () => setSheet('confirm-cancel') },
  ];

  /**
   * Commencer pour de bon : la séance est créée, puis sa première série
   * démarrée dans le même geste.
   */
  function begin(plannedWorkoutId: string, scheduledId?: string) {
    beginWorkoutSession(plannedWorkoutId, scheduledId ?? null)
      .then(reload)
      // Le paramètre a fait son office : le garder ramènerait sur l'écran
      // d'attente si la séance était annulée. Mais il ne se vide qu'APRÈS
      // le rechargement, pour la même raison que ci-dessus.
      .then(() => router.setParams({ plan: '', scheduled: '' }))
      .catch((e) => notify(messageOf(e)));
  }

  const waiting = planParam ? plans.find((candidate) => candidate.id === planParam) : undefined;

  /**
   * L'exercice choisi pour une séance libre, avant qu'elle ne commence.
   *
   * Le MÊME écran que pendant la séance -- le nom, les séries, les valeurs --
   * à ceci près qu'il ne s'est encore rien passé : une seule série, prévue,
   * et un bouton pour s'y mettre. Rien n'est écrit tant qu'on ne l'a pas
   * tapé, donc revenir en arrière n'a rien à annuler.
   */
  const pendingExercise = pending ? exercises.find((e) => e.id === pending) : undefined;

  if (!session && pendingExercise) {
    const targets = freeTargets ?? defaultTargets(pendingExercise.measurementIds);
    const soleDuration =
      pendingExercise.measurementIds.length === 1 &&
      isDuration(unitOf(pendingExercise.measurementIds[0]));

    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background px-5 pb-2 pt-4 dark:bg-background-dark">
        <BackHeader
          title="Séance libre"
          subtitle="rien n'a encore commencé"
          onBack={() => setPending(null)}
          onMenu={() => setSheet('pending-menu')}
        />

        <Text
          className="font-black uppercase text-display tracking-tighter text-ink dark:text-ink-dark"
          numberOfLines={2}
        >
          {pendingExercise.name}
        </Text>

        <Text className="mt-6 py-2 font-bold uppercase text-label text-muted dark:text-muted-dark">
          Séries 0/1
        </Text>

        <View className="gap-2 px-1 pt-0.5">
          {/* Taper la série ouvre ses valeurs : les cibles de départ sont une
              proposition, pas une consigne. */}
          <SetRow
            index={1}
            status="planned"
            values={formatPlanned(targets)}
            selected={adjustingStart}
            onPress={() => setAdjustingStart((open) => !open)}
          />
        </View>

        {/* Le vide de l'écran referme le réglage, comme pendant la séance :
            c'est la cible la plus large, et le seul endroit où taper ne veut
            rien dire d'autre. */}
        <Pressable className="flex-1" onPress={() => setAdjustingStart(false)} />

        <View className="gap-3 pb-2">
          {adjustingStart ? (
            <View className="flex-row gap-3">
              {pendingExercise.measurementIds.map((id) => (
                <MeasureField
                  key={id}
                  unit={unitOf(id)}
                  measurementId={id}
                  value={targets[id] ?? 0}
                  onChange={(value) => setFreeTargets({ ...targets, [id]: value })}
                  autoOpen={soleDuration}
                  onDone={soleDuration ? () => setAdjustingStart(false) : undefined}
                />
              ))}
            </View>
          ) : (
            // Pendant qu'on règle, « Let's go » occupe la place où la main va
            // et partirait pour tout autre chose que ce qu'on est en train de
            // faire.
            <>
              {/* Le même « play » que le départ d'une série : c'en est un,
                  à ceci près qu'il fait naître la séance avec. */}
              <Button
                label="Let's go"
                icon="play"
                size="xl"
                onPress={() => beginFree(pendingExercise.id)}
              />
              {/* La cible réglée juste au-dessus vaut pour chaque round : rien
                  d'autre à répéter ici. */}
              <Pressable onPress={() => setConfiguringEmom(true)} className="py-2">
                <Text className="text-center text-lead text-primary-ink dark:text-primary-ink-dark">
                  Démarrer en EMOM
                </Text>
              </Pressable>
            </>
          )}
        </View>

        {/* Un rythme imposé plutôt qu'un chrono : la cible ci-dessus vaut
            pour chaque round, seule la durée totale se règle ici -- le
            nombre de rounds s'en déduit (une minute chacun). */}
        <Sheet
          visible={configuringEmom}
          title="Démarrer en EMOM"
          description={`${pendingExercise.name} · cible ${formatPlanned(targets)}`}
          onClose={() => setConfiguringEmom(false)}
        >
          <View className="gap-4 pb-2">
            {/* flex-row : MeasureField (et sa variante durée) porte flex-1
                pour se PARTAGER une ligne avec d'autres champs -- posé seul
                dans une colonne, il s'étirait en hauteur et écrasait le
                bouton en dessous. */}
            <View className="flex-row gap-3">
              <MeasureField
                unit="s"
                measurementId="duration"
                value={emomTotalSeconds}
                onChange={setEmomTotalSeconds}
              />
            </View>
            <Button
              label="Démarrer"
              size="lg"
              onPress={() => beginFreeEmom(pendingExercise.id, emomTotalSeconds)}
            />
          </View>
        </Sheet>

        {/* Le menu ne propose que ce qui existe à ce stade : rien n'a été
            écrit, donc rien à abandonner ni à terminer. */}
        <Sheet
          visible={sheet === 'pending-menu'}
          title="Avant de commencer"
          actions={[
            { label: "Changer d'exercice", onPress: () => setSheet('pick-exercise') },
            {
              label: 'Ne pas commencer',
              onPress: () => {
                setSheet('none');
                setPending(null);
              },
            },
          ]}
          onClose={() => setSheet('none')}
        />

        {exercisePicker(choose)}
      </SafeAreaView>
    );
  }

  if (!session && waiting) {
    const sets = waiting.exercises.reduce((total, entry) => total + entry.sets.length, 0);

    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
        <View className="px-5 pt-4">
          {/* Une flèche de retour comme partout ailleurs : le paramètre se
              vide en partant, sinon revenir ramènerait ici. */}
          <BackHeader
            title={waiting.name}
            subtitle={`${waiting.exercises.length} exercice${waiting.exercises.length > 1 ? 's' : ''} · ${sets} série${sets > 1 ? 's' : ''} prévue${sets > 1 ? 's' : ''}`}
            onBack={() => {
              router.setParams({ plan: '', scheduled: '' });
              router.back();
            }}
          />
        </View>

        <ScrollView
          contentContainerClassName="grow gap-3 px-5 pb-4"
          keyboardShouldPersistTaps="handled"
        >

          {waiting.exercises.map((planned, position) => (
            <Card key={`${planned.exerciseId}-${position}`} density="titled" className="gap-1">
              <Text className="font-bold text-body text-ink dark:text-ink-dark" numberOfLines={1}>
                {position + 1}. {nameOf(planned.exerciseId)}
              </Text>
              {/* Le rythme AVANT de s'y mettre : c'est ce qui change la façon
                  de s'échauffer. Les rounds, eux, se lisent comme les séries
                  qu'ils sont. */}
              {planned.intervalSeconds ? (
                <Text className="text-caption text-muted dark:text-muted-dark">
                  {formatEmomPace(planned.intervalSeconds)}
                </Text>
              ) : null}
              {planned.sets.map((set, index) => (
                <Text
                  key={index}
                  className="font-mono text-caption text-planned dark:text-planned-dark"
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {index + 1}.  {formatTargets(set.targets, unitOf)}
                </Text>
              ))}
            </Card>
          ))}
        </ScrollView>

        <View className="px-5 pb-2">
          <Button
            label="Let's go"
            icon="play"
            size="xl"
            onPress={() => begin(waiting.id, scheduledParam || undefined)}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    const now = new Date();
    const isToday = (date: Date) => date.toDateString() === now.toDateString();
    const overdue = schedule.filter((entry) => entry.isOverdue(now) && !isToday(entry.scheduledAt));
    const today = schedule.filter((entry) => isToday(entry.scheduledAt));
    const upcoming = schedule.filter((entry) => entry.scheduledAt > now && !isToday(entry.scheduledAt));

    const planNameOf = (id: string) => plans.find((plan) => plan.id === id)?.name ?? id;

    const entryCard = (entry: ScheduledWorkout, note?: string) => (
      <Card key={entry.id} density="titled" className="gap-2">
        <View className="flex-row items-start justify-between gap-3">
          <View className="shrink">
            <Text className="font-extrabold text-body text-ink dark:text-ink-dark">
              {planNameOf(entry.plannedWorkoutId)}
            </Text>
            <Text className="font-mono text-caption text-muted dark:text-muted-dark">
              {note ?? formatDateTime(entry.scheduledAt)}
            </Text>
          </View>
          <View className="flex-row gap-3 pt-1">
            <Pressable onPress={() => setMoving(entry)} hitSlop={8}>
              <Text className="text-small text-primary-ink dark:text-primary-ink-dark">
                déplacer
              </Text>
            </Pressable>
            <Pressable onPress={() => run(() => cancelScheduledWorkout(entry))} hitSlop={8}>
              <Text className="text-caption text-danger dark:text-danger-dark">annuler</Text>
            </Pressable>
          </View>
        </View>
        <Button
          label="Démarrer"
          size="md"
          // Pas de séance créée ici non plus : on va à l'écran d'attente.
          onPress={() =>
            router.setParams({ plan: entry.plannedWorkoutId, scheduled: entry.id })
          }
        />
      </Card>
    );

    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
        <View className="px-5 pt-4">
          <SectionHeader
            title="Séance"
            subtitle={
              schedule.length > 0
                ? `${schedule.length} entraînement${schedule.length > 1 ? 's' : ''} programmé${schedule.length > 1 ? 's' : ''}`
                : 'aucune séance en cours'
            }
          />
        </View>

        <ScrollView
          contentContainerClassName="grow gap-3 px-5 pb-4"
          keyboardShouldPersistTaps="handled"
        >

          {today.length > 0 && (
            <>
              <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
                Aujourd'hui
              </Text>
              {today.map((entry) => entryCard(entry, "aujourd'hui"))}
            </>
          )}

          {/* En retard, jamais "manqué" : la séance reste à faire. */}
          {overdue.length > 0 && (
            <>
              <Text className="mt-2 font-bold uppercase text-label text-muted dark:text-muted-dark">
                En retard
              </Text>
              {overdue.map((entry) => entryCard(entry))}
            </>
          )}

          {upcoming.length > 0 && (
            <>
              <Text className="mt-2 font-bold uppercase text-label text-muted dark:text-muted-dark">
                À venir
              </Text>
              {upcoming.map((entry) => entryCard(entry))}
            </>
          )}

          {schedule.length === 0 && (
            <EmptyState
              title="Aucune séance en cours"
              description="Programme un entraînement pour un autre jour, ou démarre-en un maintenant."
            />
          )}
        </ScrollView>

        <DatePickerSheet
          visible={moving !== null}
          title="Déplacer cette séance"
          confirmLabel="Déplacer"
          initial={moving?.scheduledAt}
          onConfirm={(date) => {
            const entry = moving;
            setMoving(null);
            if (entry) run(() => rescheduleWorkout(entry, date));
          }}
          onClose={() => setMoving(null)}
        />

        <View className="gap-2 px-5 pb-2">
          <View className="flex-row gap-2">
            <Button
              label="Entraînement"
              variant="secondary"
              size="md"
              className="flex-1"
              onPress={() => router.push('/workouts')}
            />
            {/* Programmer appartient ICI : c'est la page des séances qui parle
                du calendrier, pas la fiche d'un entraînement, qui décrit ce
                qu'il contient. */}
            <Button
              label="Programmer"
              variant="secondary"
              size="md"
              className="flex-1"
              disabled={plans.length === 0}
              onPress={() => setPlanning({ plan: null })}
            />
          </View>
          <Button
            label="Séance libre"
            variant="ghost"
            size="md"
            onPress={() => setSheet('pick-exercise')}
          />
        </View>

        {/* Programmer se fait en deux temps : quel entraînement, puis quand. */}
        <Sheet
          visible={planning !== null && planning.plan === null}
          title="Programmer un entraînement"
          description="Il sera à faire à la date choisie, sans démarrer maintenant."
          searchPlaceholder="Chercher un entraînement"
          actions={plans
            .filter((candidate) => !candidate.isArchived)
            .map((candidate) => ({
              label: candidate.name,
              onPress: () => setPlanning({ plan: candidate }),
            }))}
          onClose={() => setPlanning(null)}
        />

        <DatePickerSheet
          visible={planning?.plan != null}
          title={planning?.plan ? `Programmer « ${planning.plan.name} »` : ''}
          confirmLabel="Programmer"
          onConfirm={(at) => {
            const chosen = planning?.plan;
            setPlanning(null);
            if (chosen) run(() => scheduleWorkout({ plannedWorkoutId: chosen.id, at }));
          }}
          onClose={() => setPlanning(null)}
        />

        {exercisePicker(choose)}
      </SafeAreaView>
    );
  }

  const position =
    activity?.plannedPosition != null && plan
      ? `exercice ${activity.plannedPosition + 1}/${plan.exercises.length} · ${plannedExercise?.intervalSeconds ? 'round' : 'série'} ${nextSetIndex + (performance?.currentSet ? 0 : 1)} sur ${plannedExercise?.sets.length ?? '—'}`
      : 'séance libre';

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background px-5 pb-2 pt-4 dark:bg-background-dark">
      <SessionHeader
        workoutName={plan ? plan.name : 'Séance libre'}
        position={position}
        onMenu={() => setSheet('menu')}
      />

      {activity ? (
        /* Un exercice qui entre par le côté : passer au suivant est un
           MOUVEMENT, et sans lui l'écran se remplaçait d'une image à l'autre
           -- même nom d'exercice à la même place, on ne savait pas toujours
           si le tap avait pris. Le contenu change avec la performance, donc
           c'est elle qui donne le signal. */
        <SlideIn
          token={activity.performanceId ?? activity.exerciseId}
          from={comingFrom}
          className="flex-1"
        >
          <Text
            className="font-black uppercase text-display tracking-tighter text-ink dark:text-ink-dark"
            numberOfLines={2}
          >
            {nameOf(activity.exerciseId)}
          </Text>
          <Pressable
            onPress={() => setShowDetail((v) => !v)}
            className="mt-6 flex-row items-center justify-between py-2"
          >
            <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
              {/* Au rythme de l'horloge, ce ne sont plus des séries qu'on
                  compte : le mot suit ce qu'on est en train de faire. */}
              {emom ? 'Rounds' : 'Séries'} {completedCount}/{totalSets || '—'}
            </Text>
            <Text className="font-mono text-small text-muted dark:text-muted-dark">
              {showDetail ? 'réduire ⌃' : 'détail ⌄'}
            </Text>
          </Pressable>

          {showDetail ? (
            <ScrollView
              key={activity.performanceId ?? 'none'}
              keyboardShouldPersistTaps="handled"
              className="shrink grow-0"
              // Quatre lignes, pas une hauteur en pourcentage : au-delà, la
              // liste mangeait l'anneau et les boutons sur les petits écrans.
              // Ce qui dépasse se fait défiler.
              style={{ maxHeight: 4 * (SET_ROW_HEIGHT + SET_ROW_GAP) }}
              contentContainerClassName="gap-2 px-1 pb-1 pt-0.5"
            >
              {sets.map((set, index) => (
                <SetRow
                  key={`${activity.performanceId}-${index}`}
                  index={index + 1}
                  status={statusOf(set.status)}
                  // Une série déjà enregistrée peut être rouverte pour
                  // corriger ce qu'on a réellement fait.
                  onPress={set.status === 'IN_PROGRESS' ? undefined : () => toggleEditing(index)}
                  selected={editing === index}
                  onPlay={set.videoUri ? () => setWatching(set.videoUri) : undefined}
                  values={
                    format(
                      editing === index
                        ? editedValues
                        : index === lastSetIndex && !isPast(set)
                          ? shown
                          : set.values,
                    ) || '—'
                  }
                />
              ))}
              {plannedExercise?.sets.slice(nextSetIndex).map((set, index) => (
                <SetRow
                  key={`${activity.performanceId}-planned-${index}`}
                  index={nextSetIndex + index + 1}
                  status="planned"
                  values={formatPlanned(set.targets)}
                />
              ))}
            </ScrollView>
          ) : (
            <ScrollView
              key={activity.performanceId ?? 'none'}
              keyboardShouldPersistTaps="handled"
              horizontal
              showsHorizontalScrollIndicator={false}
              className="max-h-12 grow-0"
              contentContainerClassName="gap-2 px-1 pr-4"
            >
              {sets.map((set, index) => (
                <SetChip
                  key={`${activity.performanceId}-${index}`}
                  index={index + 1}
                  status={statusOf(set.status)}
                  // Repliée ou dépliée, la liste ouvre les mêmes séries : la
                  // série en cours se règle par les boutons du bas, les
                  // autres se corrigent en les tapant.
                  onPress={set.status === 'IN_PROGRESS' ? undefined : () => toggleEditing(index)}
                  selected={editing === index}
                  // La série ajustée montre la valeur en cours, sans attendre
                  // le prochain rechargement.
                  values={formatShort(index === lastSetIndex && !isPast(set) ? shown : set.values) || '—'}
                />
              ))}
              {plannedExercise?.sets.slice(nextSetIndex).map((set, index) => (
                <SetChip
                  key={`${activity.performanceId}-planned-${index}`}
                  index={nextSetIndex + index + 1}
                  status="planned"
                  values={formatPlannedShort(set.targets)}
                />
              ))}
            </ScrollView>
          )}

          {emom ? (
            /* L'anneau ne demande rien : il montre juste ce qu'il reste. Le
               round avance à l'horloge, jamais au tap (voir l'effet
               d'avance automatique plus haut). */
            <Pressable
              className="flex-1 items-center justify-center"
              onPress={() => editing !== null && toggleEditing(editing)}
            >
              <CountdownRing
                remainingSeconds={emomState?.remainingSeconds ?? emom.intervalSeconds}
                totalSeconds={emom.intervalSeconds}
              />
              <Text className="pt-3 font-bold uppercase text-label text-muted dark:text-muted-dark">
                Round {Math.min(sets.length, emom.totalRounds)}/{emom.totalRounds}
                {emom.pausedAt ? ' · en pause' : ''}
              </Text>
            </Pressable>
          ) : (
            /* Le chrono occupe le centre de l'écran pendant la récupération.

               Et c'est le VIDE de l'écran : y taper referme l'ajustement en
               cours, comme retaper la série elle-même. Rien à apprendre, et
               donc pas de bouton pour le dire. */
            <Pressable
              className="flex-1 items-center justify-center"
              onPress={() => editing !== null && toggleEditing(editing)}
            >
              {resting && <Timer seconds={restElapsed} large />}
            </Pressable>
          )}

          <View className="gap-3 pb-2">
            {/* Corriger une série déjà validée reste possible pendant un EMOM
                comme en dehors, mais pas au même endroit : sous l'anneau, il
                ne reste pas de place pour les champs -- ils lui montaient
                dessus. Pendant un round, la correction passe donc par une
                feuille (voir plus bas) ; le reste du temps, elle s'inscrit
                sous le chrono, qui lui laisse la place. */}
            {editing !== null && editedSet && !emom && setControls()}

            {editing === null &&
              (emomOffered ? (
                /* Le plan veut cet exercice en EMOM, et le rythme n'est pas
                   lancé : c'est LA chose à faire ici, avant la série elle-même
                   -- l'horloge part avec elle. */
                <Button
                  label="Démarrer l'EMOM"
                  // Un chronomètre plutôt qu'une lecture : ce bouton
                  // n'ouvre pas une série, il lance la minute qui les
                  // enchaînera -- et il annonce l'anneau qui va suivre.
                  icon="timer"
                  size="lg"
                  onPress={startPlannedEmom}
                />
              ) : emom ? (
                performance?.currentSet ? (
                  <View className="flex-row gap-3">
                    {/* Le round qu'on est en train de faire est le seul qu'on
                        puisse encore montrer. */}
                    <Button
                      label={lastSet?.videoUri ? 'Refilmer ce round' : 'Filmer ce round'}
                      icon="videocam"
                      variant="secondary"
                      size="lg"
                      onPress={() => film(lastSetIndex)}
                    />
                    <Button
                      label="Fini"
                      icon="checkmark"
                      size="lg"
                      className="flex-1"
                      onPress={() => run(() => completePerformanceSet(shown))}
                    />
                  </View>
                ) : sets.length === 0 ? null : isFinalEmomRound ? (
                  // Le dernier round prévu vient d'être noté : le choix se
                  // fait ICI, pas en silence à la fin du minuteur -- sinon
                  // rien ne distingue "encore un peu de repos" de "c'est
                  // reparti pour un round de plus".
                  <View className="gap-3">
                    <Text className="text-center text-body text-muted dark:text-muted-dark">
                      Dernier round noté.
                    </Text>
                    <View className="flex-row gap-3">
                      <Button
                        label="Ajouter un round"
                        variant="secondary"
                        size="lg"
                        className="flex-1"
                        onPress={addEmomRound}
                      />
                      <Button
                        label="Arrêter l'EMOM"
                        size="lg"
                        className="flex-1"
                        onPress={stopEmom}
                      />
                    </View>
                  </View>
                ) : (
                  // Entre deux rounds seulement : au milieu de l'un, l'horloge
                  // continue même sans toi. Deux gestes, sans un mot pour les
                  // dire -- l'anneau et le compteur de rounds montrent déjà où
                  // l'on en est.
                  //
                  // Pas de caméra ici : le round est fini, il n'y a plus rien
                  // à montrer. Elle appartient au round EN COURS, et c'est là
                  // qu'elle se trouve.
                  <View className="flex-row gap-3">
                    {/* En rouge, et à la largeur de son icône : c'est le seul
                        des trois qui ferme quelque chose. Les deux autres
                        règlent le rythme et se partagent la barre -- ce sont
                        eux qu'on vise entre deux rounds, pas celui-ci. */}
                    <Button
                      label="Arrêter l'EMOM"
                      icon="stop"
                      variant="danger"
                      size="lg"
                      onPress={stopEmom}
                    />
                    <Button
                      label={emom.pausedAt ? "Reprendre l'EMOM" : "Mettre l'EMOM en pause"}
                      icon={emom.pausedAt ? 'play' : 'pause'}
                      // En pause, reprendre est la seule suite : l'aplat le
                      // dit, comme partout ailleurs dans l'app.
                      variant={emom.pausedAt ? 'primary' : 'secondary'}
                      size="lg"
                      className="flex-1"
                      onPress={toggleEmomPause}
                    />
                    {/* Prêt avant la minute : l'horloge REPART, elle ne se
                        rattrape pas -- le round qui démarre a sa minute
                        pleine. */}
                    <Button
                      label="Round suivant"
                      icon="play-skip-forward"
                      variant="secondary"
                      size="lg"
                      className="flex-1"
                      onPress={startNextRound}
                    />
                  </View>
                )
              ) : performance?.currentSet ? (
                <View className="flex-row gap-3">
                  {/* Filmer appartient à la série EN COURS : c'est celle qu'on
                      est en train de faire, et la seule qu'on puisse encore
                      montrer. Posée AVANT « Terminer » : on filme pendant la
                      série, on la termine après -- et le geste qui clôt garde
                      le bord du pouce. */}
                  <Button
                    label={lastSet?.videoUri ? 'Refilmer' : 'Filmer'}
                    icon="videocam"
                    variant="secondary"
                    size="lg"
                    onPress={() => film(lastSetIndex)}
                  />
                  {/* La même coche que pendant un EMOM, et que celle qui
                      marque une série faite dans la liste : clore une série
                      est le même geste, qu'on suive l'horloge ou son souffle. */}
                  <Button
                    label="Terminer"
                    icon="checkmark"
                    size="lg"
                    className="flex-1"
                    onPress={() => run(() => completePerformanceSet(shown))}
                  />
                </View>
              ) : (
                // Hors série en cours : lancer la série suivante. Passer à
                // l'exercice suivant ne s'offre qu'une fois le programme de
                // celui-ci épuisé -- au milieu des séries prévues, ce serait
                // proposer d'abandonner ce qu'on est en train de faire. Le
                // menu garde l'échappatoire pour les jours où l'on écourte.
                <View className="flex-row gap-3">
                  <Button
                    label={plannedDone ? 'Nouvelle série' : 'Démarrer'}
                    // Une série DE PLUS, une fois le programme épuisé : le
                    // pictogramme suffit à la dire, et rend la largeur à
                    // « Suivant », qui est alors la suite normale des choses.
                    icon={plannedDone ? 'refresh' : 'play'}
                    variant={plannedDone ? 'secondary' : 'primary'}
                    size="lg"
                    className={plannedDone ? undefined : 'flex-1'}
                    onPress={beginSet}
                  />
                  {plannedDone && (
                    // Une flèche, là où le round suivant porte un saut de
                    // lecture : on avance dans le programme, on ne coupe pas
                    // court à une minute.
                    <Button
                      label="Exercice suivant"
                      icon="arrow-forward"
                      size="lg"
                      className="flex-1"
                      onPress={nextExercise}
                    />
                  )}
                </View>
              ))}
          </View>
        </SlideIn>
      ) : (
        <View className="mt-auto gap-3">
          <Text className="text-muted dark:text-muted-dark">Aucun exercice en cours.</Text>
          {/* Une séance libre démarre ici : sans ce bouton, elle ne pouvait
              que se terminer. */}
          <Button label="Choisir un exercice" size="lg" onPress={() => setSheet('pick-exercise')} />
          <Button
            label="Terminer la séance"
            variant="secondary"
            size="lg"
            onPress={finish}
          />
        </View>
      )}
      {/* Pendant un EMOM, corriger une série passe par une feuille : l'anneau
          occupe le centre de l'écran, et les champs posés dessous lui
          montaient dessus. Elle dit quel round elle règle -- on la rouvre
          entre deux rounds, l'horloge continuant derrière. */}
      <Sheet
        visible={Boolean(emom) && editing !== null && editedSet !== undefined}
        title={`Round ${(editing ?? 0) + 1}`}
        description={nameOf(activity?.exerciseId ?? '')}
        onClose={closeEditing}
      >
        <View className="gap-3 pb-2">{editing !== null && editedSet && setControls()}</View>
      </Sheet>

      <Sheet
        visible={sheet === 'menu'}
        title="Séance"
        actions={menuActions}
        onClose={() => setSheet('none')}
      />
      <Sheet
        visible={sheet === 'end-of-plan'}
        title="Programme terminé"
        description="Tous les exercices prévus sont faits. Tu peux t'arrêter là ou continuer librement."
        actions={[
          { label: 'Terminer la séance', onPress: finish },
          { label: 'Ajouter un exercice', onPress: () => setSheet('pick-exercise') },
        ]}
        onClose={() => setSheet('none')}
      />
      {exercisePicker(addExercise)}
      <SetVideoViewer
        uri={watching ? fileUri(watching) : null}
        onClose={() => setWatching(null)}
        onDelete={() => {
          const index = sets.findIndex((set) => set.videoUri === watching);
          setWatching(null);
          if (index >= 0 && activity?.performanceId) {
            run(() => detachSetVideo(activity.performanceId!, index));
          }
        }}
      />

      <Sheet
        visible={sheet === 'confirm-cancel'}
        title="Annuler la séance ?"
        description="Les séries déjà validées seront conservées dans ton historique."
        actions={[
          {
            label: 'Annuler la séance',
            tone: 'danger',
            onPress: () => run(cancelWorkoutSession),
          },
        ]}
        onClose={() => setSheet('none')}
      />
    </SafeAreaView>
  );
}

/**
 * Le rythme en cours : un round toutes les `intervalSeconds`, pendant
 * `totalRounds` rounds.
 *
 * `pausedAt` fige l'affichage à cet instant ; `windowStartedAt` replace le
 * départ de la fenêtre courante au moment de reprendre. Les deux ne vivent
 * que dans l'écran : ce qui est arrivé aux séries, lui, est écrit.
 */
type Emom = {
  intervalSeconds: number;
  totalRounds: number;
  pausedAt: Date | null;
  windowStartedAt: Date | null;
};

/** Une série close et non ajustée : ses valeurs enregistrées font foi. */
function isPast(set: { status: string }): boolean {
  return set.status === 'ABANDONED';
}

function statusOf(status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED'): SetRowStatus {
  if (status === 'COMPLETED') return 'completed';
  if (status === 'ABANDONED') return 'abandoned';
  return 'in-progress';
}
