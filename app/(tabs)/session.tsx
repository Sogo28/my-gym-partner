import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useNotifications } from '../../src/ui/notifications';
import { messageOf } from '../../src/ui/message';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, Pressable, ScrollView, Text, View } from 'react-native';
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
import { findLastDoneByPlan } from '../../src/infra/session-history';
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
import { feelRestLap, feelSetDone, feelStart } from '../../src/ui/haptics';
import { SET_ROW_GAP, SET_ROW_HEIGHT, SetRow, type SetRowStatus } from '../../src/ui/set-row';
import { ScrollHint } from '../../src/ui/scroll-hint';
import { usePalette } from '../../src/ui/palette';
import { MetaLine, type MetaItem } from '../../src/ui/meta-line';
import { SetupCountdown } from '../../src/ui/setup-countdown';
import {
  countdownBeforeSet,
  emomSetupCountdown,
  restSignal,
  restSignalEvery,
  type RestSignal,
} from '../../src/use-cases/preferences';
import { RestRing } from '../../src/ui/rest-ring';
import { SetPulse } from '../../src/ui/set-pulse';
import { LATE_MS, useAt, useLastSeconds, useNow } from '../../src/ui/use-now';
import {
  prepareSessionAlerts,
  useSessionAlerts,
  type SessionAlert,
} from '../../src/ui/session-alerts';
import { nextPlannedPosition } from '../../src/domain/workout-session/next-planned';
import { retargetPlannedSet } from '../../src/use-cases/create-planned-workout';
import { MeasureField } from '../../src/ui/measure-field';
import { Timer } from '../../src/ui/timer';
import { CountdownRing, ringSizeIn } from '../../src/ui/countdown-ring';
import {
  EMOM_INTERVAL_SECONDS,
  emomStatus,
} from '../../src/domain/workout-session/emom';
import {
  formatEmomPace,
  formatSetValues,
  formatSetValuesShort,
  formatTargets,
  formatTargetsShort,
} from '../../src/ui/set-values';
import { formatClock, formatDateTime, isDuration, lastDoneLabel } from '../../src/ui/format';
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
import { takeCreated } from '../../src/ui/created-exercise';
import { SetVideoViewer } from '../../src/ui/set-video';
import { fileUri } from '../../src/use-cases/media-actions';
import { detachSetVideo } from '../../src/use-cases/set-video';
import { SetIndex } from '../../src/ui/set-index';

/**
 * L'étiquette du verrou qui garde l'écran allumé.
 *
 * expo-keep-awake compte les verrous par étiquette : celui qu'on prend doit
 * se rendre sous le MÊME nom, sinon l'écran ne se rendort jamais. Nommée ici
 * plutôt qu'écrite deux fois à la main.
 */
const KEEP_AWAKE = 'session-en-cours';

/**
 * Un EMOM ARMÉ : décidé, pas encore commencé.
 *
 * Rien n'est écrit pendant ce temps -- ni séance, ni exercice, ni série. Une
 * séance DATE de sa première série (voir `beginWorkoutSession`), et la faire
 * naître au tap lui donnerait pour début le moment où l'on range le
 * téléphone. L'intention vit donc dans l'écran, et n'engage rien.
 */
type Arming = {
  readonly armedAt: Date;
  readonly seconds: number;
  readonly intervalSeconds: number;
  readonly totalRounds: number;
  /** Séance libre : l'exercice dont la séance naîtra. Entraînement prévu : null. */
  readonly exerciseId: string | null;
};

/** Ce que « ROUND 5/10 » occupe sous l'anneau : son écart et sa ligne. */
const ROUND_LABEL = 32;
/** La même chose pour la ligne de l'exercice suivant, sous l'anneau du repos. */
const NEXT_LABEL = 28;

export default function SessionScreen() {
  const { notify } = useNotifications();
  const { muted, onPrimary, primaryInk } = usePalette();
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
  /** La dernière séance faite de chaque entraînement, pour choisir lequel refaire. */
  const [lastDone, setLastDone] = useState<Map<string, Date>>(new Map());
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
  /** L'entraînement programmé dont le menu est ouvert. */
  const [managing, setManaging] = useState<ScheduledWorkout | null>(null);
  /** La programmation en cours : d'abord l'entraînement, puis sa date. */
  const [planning, setPlanning] = useState<{ plan: PlannedWorkout | null } | null>(null);
  const [values, setValues] = useState<ValuesBySide>({});
  // La série dont on ajuste les valeurs, ouverte en tapant sa ligne.
  const [editing, setEditing] = useState<number | null>(null);
  /**
   * Les cibles du JOUR, changées sur des séries prévues, par performance et
   * par rang (`<performance>:<rang>`).
   *
   * Elles recouvrent l'entraînement sans le modifier : une forme du jour ne
   * réécrit pas un programme. Le garder aussi pour la suite se décide à part,
   * une fois le réglage refermé (décidé le 2026-10-08).
   */
  const [todayTargets, setTodayTargets] = useState<Record<string, TargetValues>>({});
  /** La série prévue dont on règle la cible, ouverte en tapant sa ligne. */
  const [retargeting, setRetargeting] = useState<number | null>(null);
  /** La cible qu'on vient de changer, en attente de savoir pour combien de temps. */
  const [askingScope, setAskingScope] = useState<{ index: number; targets: TargetValues } | null>(
    null,
  );
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
  /**
   * L'EMOM décidé, qui attend qu'on soit en position (voir `Arming`).
   *
   * `setupSeconds` est lu au réglage et gardé ici : armer doit être
   * instantané, et aller chercher la préférence à ce moment-là ferait partir
   * le décompte après un aller-retour en base.
   */
  const [arming, setArming] = useState<Arming | null>(null);
  const [setupSeconds, setSetupSeconds] = useState(10);
  /**
   * Une série décidée, qui attend la fin de son décompte pour partir.
   *
   * Rien n'est écrit pendant qu'il tourne : la série ne commence qu'à zéro,
   * et le repos court jusque-là. Annuler ne laisse donc rien derrière.
   * `go` est le geste qu'on a tapé -- démarrer la série, ou la séance avec
   * sa première série --, simplement remis à plus tard.
   */
  const [getReady, setGetReady] = useState<{
    armedAt: Date;
    seconds: number;
    caption: string;
    /** Rend la main une fois la série À L'ÉCRAN : le décompte la couvre jusque-là. */
    go: (at: Date) => Promise<unknown>;
  } | null>(null);
  /** Même rôle que `launchingEmom`, pour le départ d'une série. */
  const launchingSet = useRef(false);
  /**
   * La série qui part à zéro sera-t-elle filmée ? Coché pendant le décompte ;
   * un ref en plus de l'état, pour que le départ lise le dernier choix.
   */
  const [filmNext, setFilmNext] = useState(false);
  const filmNextRef = useRef(false);
  const [beforeSetSeconds, setBeforeSetSeconds] = useState(3);
  const [restSignalChoice, setRestSignalChoice] = useState<RestSignal>('vibration');
  const [restEvery, setRestEvery] = useState(60);
  /** Empêche l'avance automatique de se déclencher deux fois pour le même round. */
  const advancingEmomRound = useRef(false);
  /** Même rôle, pour le départ qui suit le décompte de mise en place. */
  const launchingEmom = useRef(false);
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
  /**
   * Ce que le sélecteur d'exercice devait faire de son choix, quand il a
   * ouvert le formulaire de création à la place : choisir le premier
   * exercice d'une séance libre, ou en ajouter un.
   */
  const pickedBy = useRef<((exerciseId: string) => void) | null>(null);
  /** Le rang du round déjà annoncé au son : on ne sonne pas deux fois. */
  const soundedRound = useRef(0);
  /** Les séries faites déjà signalées à la main, performance par performance. */
  const feltDone = useRef<{ performanceId: string | null; count: number }>({
    performanceId: null,
    count: 0,
  });

  const reload = useCallback(async () => {
    const [
      active,
      allExercises,
      allPlans,
      allMeasurements,
      allSchedule,
      allMuscles,
      recent,
      done,
    ] = await Promise.all([
      findActive(),
      findAllExercises(),
      findAllPlans(),
      findAllMeasurements(),
      listSchedule(),
      findAllMuscles(),
      findRecentExerciseIds(),
      findLastDoneByPlan(),
    ]);
    setSession(active);
    setExercises(allExercises);
    setPlans(allPlans);
    setMeasurements(allMeasurements);
    setMuscles(allMuscles);
    setRecentIds(recent);
    setLastDone(done);
    // Seules les intentions encore ouvertes intéressent l'écran.
    setSchedule(allSchedule.filter((entry) => entry.status === 'SCHEDULED'));

    const performanceId = active?.currentActivity?.performanceId ?? null;
    setPerformance(performanceId ? await findPerformanceById(performanceId) : null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload().catch((e) => notify(messageOf(e)));
      emomSetupCountdown().then(setSetupSeconds).catch((e) => notify(messageOf(e)));
      countdownBeforeSet().then(setBeforeSetSeconds).catch((e) => notify(messageOf(e)));
      restSignal().then(setRestSignalChoice).catch((e) => notify(messageOf(e)));
      restSignalEvery().then(setRestEvery).catch((e) => notify(messageOf(e)));

      // Couper l'enregistrement, c'est dire qu'on a fini la série : on ne
      // s'arrête pas de filmer au milieu d'un mouvement.
      if (takeStoppedByHand()) setFinishAfterFilm(true);

      // Revenir du formulaire d'exercice reprend le geste interrompu : un
      // exercice créé depuis le sélecteur est celui qu'on voulait choisir,
      // il n'a pas à être recherché et recoché.
      const created = takeCreated();
      const pick = pickedBy.current;
      pickedBy.current = null;
      if (created && pick) pick(created);

      // Un exercice choisi et non démarré n'engage rien, et n'a donc pas à
      // survivre au départ de l'écran : revenir sur les séances repart de
      // zéro plutôt que de reprendre une intention qu'on avait laissée.
      // Les valeurs réglées, elles, restent : la série en cours les porte
      // encore, et changer d'exercice les remplace de toute façon.
      return () => {
        setPending(null);
        setAdjustingStart(false);
        setConfiguringEmom(false);
        // L'EMOM armé n'a rien écrit : le laisser courir ferait naître une
        // séance pendant qu'on regarde un autre onglet.
        setArming(null);
        setGetReady(null);
      };
    }, [reload]),
  );

  /**
   * L'écran reste allumé pendant qu'une séance est en cours.
   *
   * Le téléphone est posé sur le banc, et l'app affiche précisément ce qu'on
   * vient y lire entre deux séries : le temps de repos qui monte, l'anneau
   * d'un EMOM qui descend. Une veille au bout de trente secondes obligeait à
   * déverrouiller à chaque série -- et pire, à rater le décompte des cinq
   * dernières secondes d'un round, qui ne sonne que si l'écran vit.
   *
   * Lié au FOCUS autant qu'à la séance : le verrou se prend en arrivant sur
   * cet écran avec une séance en cours, et se rend en le quittant. Le garder
   * pour toute la durée de la séance, où qu'on aille, laissait un téléphone
   * allumé indéfiniment le jour où la séance se termine ailleurs -- l'écran
   * d'un exercice sait le faire (voir exercise.tsx), et celui-ci ne
   * l'apprendrait qu'en reprenant la main.
   *
   * Sur l'identifiant de la séance et non sur la séance : elle est un objet
   * neuf à chaque rechargement, et le verrou se reprendrait quatre fois par
   * seconde pendant un EMOM.
   */
  /**
   * La place réellement laissée à l'anneau, mesurée plutôt que supposée.
   *
   * Ce qui l'entoure n'a pas la même hauteur d'un téléphone à l'autre : le
   * nom de l'exercice tient sur une ou deux lignes, la liste des séries
   * s'ouvre ou se replie, et la barre de gestes mange ce qu'elle veut. Une
   * taille choisie une fois pour toutes tenait donc ici et débordait là --
   * l'anneau montant sur la dernière série, le rang du round passant sous la
   * barre du bas (Galaxy A15, 2026-09-27).
   */
  const [ringBox, setRingBox] = useState<{ width: number; height: number } | null>(null);

  /**
   * De quoi dire qu'une cinquième série attend sous les quatre qu'on voit.
   *
   * Le défilement passe par une valeur ANIMÉE et non par un état : il
   * déplacerait sinon la barre en re-rendant tout l'écran, soixante fois par
   * seconde, sur une page qui bat déjà quatre fois par seconde.
   */
  const listOffset = useRef(new Animated.Value(0)).current;
  const [listBox, setListBox] = useState({ visible: 0, content: 0 });
  const listRef = useRef<ScrollView>(null);
  const chipsRef = useRef<ScrollView>(null);


  const liveSessionId = session?.id ?? null;
  useFocusEffect(
    useCallback(() => {
      if (!liveSessionId) return;

      // En silence s'il échoue : un écran qui s'éteint est une gêne, pas une
      // panne, et rien ne justifie d'interrompre une séance pour le dire.
      activateKeepAwakeAsync(KEEP_AWAKE).catch(() => undefined);
      return () => {
        deactivateKeepAwake(KEEP_AWAKE).catch(() => undefined);
      };
    }, [liveSessionId]),
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
  const targetKey = (index: number) => `${activity?.performanceId ?? ''}:${index}`;
  /** Ce que vise une série prévue : la cible du jour si on l'a changée, sinon le plan. */
  const plannedTargetsAt = (index: number): TargetValues | undefined =>
    todayTargets[targetKey(index)] ?? plannedExercise?.sets[index]?.targets;

  const sets = performance?.sets ?? [];
  const nextSetIndex = sets.length;
  const lastSetIndex = nextSetIndex - 1;
  const lastSet = lastSetIndex >= 0 ? sets[lastSetIndex] : undefined;
  const resting = Boolean(session?.currentRest);
  const completedCount = sets.filter((set) => set.status === 'COMPLETED').length;
  // Toutes les séries prévues sont faites : la suivante serait une série en
  // plus du plan. Un exercice hors programme l'est dès sa première série --
  // pas avant : tout juste ajouté, il propose une série, et la démarrer est
  // ce qu'on vient faire, pas passer au suivant.
  const plannedDone = plannedExercise
    ? nextSetIndex >= plannedExercise.sets.length
    : nextSetIndex > 0;
  /**
   * Le prochain exercice du programme : le premier pas encore fait. Après un
   * exercice ajouté en route, c'est là que le programme reprend.
   */
  const nextPosition =
    plan && session ? nextPlannedPosition(session.activities, plan.exercises.length) : null;
  // Reste-t-il un exercice du programme à faire ?
  const hasNextExercise = nextPosition !== null;
  /**
   * L'exercice où l'on revient, quand celui en cours a été ajouté en route :
   * le bouton le nomme, on sait ainsi qu'on retrouve le programme -- et où.
   */
  const resuming = Boolean(plan && nextPosition !== null && activity && activity.plannedPosition == null);
  /** Le prochain exercice du programme, par son nom. */
  const nextName =
    plan && nextPosition !== null
      ? (exercises.find((e) => e.id === plan.exercises[nextPosition].exerciseId)?.name ?? null)
      : null;
  const resumeName = resuming ? nextName : null;
  /**
   * Les séries à venir, en pointillés sous celles déjà faites.
   *
   * Celles du programme ; et pour un exercice hors programme qui n'a encore
   * rien produit, une série proposée avec ses valeurs par défaut -- les
   * mêmes que prendra la série au démarrage. Sans elle, un exercice ajouté
   * arrivait sans aucune ligne, comme s'il n'y avait rien à faire. Rien
   * n'est écrit tant qu'on ne l'a pas démarrée.
   */
  const activityExercise = activity
    ? exercises.find((exercise) => exercise.id === activity.exerciseId)
    : undefined;
  const upcoming: readonly { targets: TargetValues }[] = plannedExercise
    ? plannedExercise.sets
        .slice(nextSetIndex)
        .map((set, offset) => ({ targets: plannedTargetsAt(nextSetIndex + offset) ?? set.targets }))
    : sets.length === 0 && activityExercise
      ? [{ targets: defaultTargets(activityExercise.measurementIds) }]
      : [];
  const totalSets = Math.max(
    sets.length,
    plannedExercise?.sets.length ?? 0,
    sets.length + (plannedExercise ? 0 : upcoming.length),
  );

  /**
   * À chaque série qui commence, la liste défile jusqu'à elle.
   *
   * Pas tout en bas : les séries prévues suivent celle en cours, et c'est
   * elle qu'on cherche. La dernière série commencée se pose donc au BAS de
   * la zone visible -- au quatrième round d'un EMOM, la liste restait en
   * haut et on ne savait plus où l'on en était.
   */
  useEffect(() => {
    if (sets.length === 0) return;
    const visible = listBox.visible || 4 * (SET_ROW_HEIGHT + SET_ROW_GAP);
    // Le haut du contenu porte un rembourrage de deux points.
    const bottom = 2 + sets.length * (SET_ROW_HEIGHT + SET_ROW_GAP);
    const timer = setTimeout(() => {
      listRef.current?.scrollTo({ y: Math.max(0, bottom - visible), animated: true });
      // Repliées, les pastilles n'ont pas de hauteur fixe à viser : tout au
      // bout, sauf quand des séries prévues suivent.
      if (upcoming.length === 0) chipsRef.current?.scrollToEnd({ animated: true });
    }, 60);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets.length, activity?.performanceId, showDetail]);

  /**
   * Les départs dont l'écran a besoin, sans jamais les faire battre ici.
   *
   * L'écran ne se redessine plus au rythme du chrono (décidé le
   * 2026-10-08) : les chiffres qui défilent ont chacun leur horloge (voir
   * `useNow`), et ce qui doit arriver à heure fixe -- un round, un départ, un
   * signal -- est programmé pour cette heure-là (`useAt`).
   */
  const restStartedAt = session?.currentRest?.startedAt.getTime() ?? null;
  /** Le départ de la série en cours, hors EMOM : son temps s'affiche au centre. */
  const liveSetStartedAt = !emom ? (performance?.currentSet?.startedAt.getTime() ?? null) : null;

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

    const targets = plannedTargetsAt(sets.length - 1);
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
  /**
   * La fin du round en cours, en millisecondes -- rien en pause : l'horloge
   * de l'écran s'arrête à l'instant du tap, et rien ne doit partir pendant.
   */
  const emomDeadline =
    emom && emomRoundStartedAt && !emom.pausedAt
      ? emomRoundStartedAt.getTime() + emom.intervalSeconds * 1000
      : null;
  /** La fin du décompte de mise en place, s'il y en a un. */
  const armingDeadline = arming ? arming.armedAt.getTime() + arming.seconds * 1000 : null;
  /** La fin du décompte avant une série, s'il y en a un. */
  const readyDeadline = getReady ? getReady.armedAt.getTime() + getReady.seconds * 1000 : null;
  /**
   * L'exercice qu'on s'apprête à faire : celui qu'on vient de choisir en
   * séance libre, ou celui de l'activité en cours dans un entraînement.
   */
  const armingName = arming?.exerciseId
    ? (exercises.find((candidate) => candidate.id === arming.exerciseId)?.name ?? '')
    : nameOf(activity?.exerciseId ?? '');

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
  useAt(emom && !isFinalEmomRound ? emomDeadline : null, () => {
    if (advancingEmomRound.current || !emom || emomDeadline === null) return;
    advancingEmomRound.current = true;

    /**
     * Le round se clôt À SA MINUTE, et le suivant part à la même : pas au
     * moment où l'écran s'en aperçoit. Téléphone verrouillé, l'app était
     * suspendue -- le système a vibré à chaque round (voir les signaux plus
     * bas), donc ils ont été faits : ceux qui sont passés entiers pendant
     * ce temps sont notés avec leur cible, et l'horloge ne glisse pas d'un
     * déverrouillage à l'autre (décidé le 2026-10-08).
     *
     * Jamais au-delà de l'avant-dernier : le dernier round se clôt au tap,
     * comme toujours.
     */
    const interval = emom.intervalSeconds * 1000;
    const total = emom.totalRounds;
    let boundary = emomDeadline;
    let started = sets.length;
    const valuesOfRound = (index: number): ValuesBySide => {
      const targets = plannedTargetsAt(index);
      return targets && Object.keys(targets).length > 0 ? spreadOverSides(targets) : shown;
    };

    run(async () => {
      if (performance?.currentSet) await completePerformanceSet(shown, new Date(boundary));
      await startPerformanceSet(new Date(boundary));
      started += 1;
      while (boundary + interval <= Date.now() && started < total) {
        boundary += interval;
        await completePerformanceSet(valuesOfRound(started - 1), new Date(boundary));
        await startPerformanceSet(new Date(boundary));
        started += 1;
      }
      // Le round suivant part de SA série : ce qu'une pause avait décalé ne
      // vaut que pour la fenêtre qu'elle a interrompue.
      setEmom((current) => (current ? { ...current, windowStartedAt: null } : current));
    }).finally(() => {
      advancingEmomRound.current = false;
    });
  });

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
    // Un round rattrapé au déverrouillage a déjà eu sa vibration -- celle du
    // système, à l'heure : le dire encore ici serait un signal en retard.
    const startedAt = sets[round - 1]?.startedAt.getTime() ?? Date.now();
    if (Date.now() - startedAt > LATE_MS) return;
    playRoundStart();
    // La musique peut couvrir les bips : le téléphone dans la poche, lui,
    // se sent.
    feelStart();
  }, [emom, sets.length]);

  /**
   * La vibration d'une série enregistrée.
   *
   * Sur le COMPTE des séries faites, comme le son sur celui des rounds : «
   * Terminer », « Fini », l'avance automatique d'un EMOM et le retour de la
   * caméra y mènent tous. Seule une hausse dans la MÊME performance compte --
   * changer d'exercice fait repartir le compte sans rien avoir terminé.
   */
  useEffect(() => {
    const performanceId = activity?.performanceId ?? null;
    const previous = feltDone.current;
    feltDone.current = { performanceId, count: completedCount };
    // Pas pour une série close à une heure déjà passée -- un round rattrapé
    // au déverrouillage : vibrer maintenant ne dirait rien de juste.
    const lastDone = [...sets].reverse().find((set) => set.status === 'COMPLETED');
    const late = lastDone?.endedAt ? Date.now() - lastDone.endedAt.getTime() > LATE_MS : false;
    if (
      performanceId !== null &&
      performanceId === previous.performanceId &&
      completedCount > previous.count &&
      !late
    ) {
      feelSetDone();
    }
  }, [activity?.performanceId, completedCount]);

  /**
   * Les cinq dernières secondes, une par une -- celles d'un round comme celles
   * de la mise en place. C'est le même signal parce que c'est la même chose à
   * dire : ça part bientôt, mets-toi en position.
   *
   * Le zéro n'est pas sonné ici : c'est le départ du round qui le dit, avec
   * son propre signal -- deux sons au même instant n'en feraient qu'un,
   * brouillon.
   *
   * En pause, rien ne s'écoule : rien ne sonne non plus.
   */
  useLastSeconds(armingDeadline ?? readyDeadline ?? emomDeadline, () => playRoundCountdown());

  /**
   * Le premier round part quand le décompte tombe à zéro.
   *
   * C'est ICI que la séance naît, et pas au tap : entre les deux il y a le
   * trajet jusqu'au mur, et une séance qui daterait du tap aurait pour
   * première série une minute déjà entamée.
   */
  useAt(armingDeadline, () => {
    if (!arming || launchingEmom.current) return;

    launchingEmom.current = true;
    const armed = arming;
    setArming(null);

    const launched = armed.exerciseId
      ? launchFreeEmom(armed.exerciseId, armed.totalRounds, new Date(armingDeadline!))
      : launchPlannedEmom(armed.intervalSeconds, armed.totalRounds, new Date(armingDeadline!));

    launched.finally(() => {
      launchingEmom.current = false;
    });
  });

  /**
   * La série part quand son décompte tombe à zéro -- c'est là qu'elle
   * commence, et non au tap. Le double bip du départ d'un round dit la même
   * chose ici : c'est parti.
   */
  useAt(readyDeadline, () => {
    if (!getReady || launchingSet.current) return;

    // Le décompte reste affiché, sur son zéro, jusqu'à ce que la série soit
    // écrite et relue. Retiré aussitôt, il découvrait l'écran d'AVANT -- la
    // fiche de l'entraînement, le temps que la séance naisse.
    launchingSet.current = true;
    // Le double bip du départ, sauf s'il arrive après coup : déverrouillé
    // bien après le zéro, la notification a déjà dit « c'est parti ».
    if (Date.now() - readyDeadline! <= LATE_MS) playRoundStart();
    const filming = filmNextRef.current;
    getReady
      // À l'heure du ZÉRO, et non du moment où l'écran le voit passer : le
      // téléphone verrouillé suspend l'app, et la série ne démarrait qu'au
      // déverrouillage.
      .go(new Date(readyDeadline!))
      // La caméra s'ouvre sur la série qui vient de naître, avec son propre
      // décompte : celui-ci a servi à se préparer, l'autre sert à poser le
      // téléphone et reculer.
      .then(() => (filming ? filmCurrentSet() : undefined))
      .catch((e) => notify(messageOf(e)))
      .finally(() => {
        setGetReady(null);
        filmNextRef.current = false;
        setFilmNext(false);
        launchingSet.current = false;
      });
  });

  /**
   * Décompter, puis faire ce qu'on a tapé. Sans décompte réglé, tout de
   * suite, comme avant.
   */
  /**
   * Ouvre la caméra sur la série EN COURS, relue en base : au départ d'une
   * séance, l'écran ne connaît pas encore la performance qui vient de naître.
   */
  async function filmCurrentSet() {
    const active = await findActive();
    const performanceId = active?.currentActivity?.performanceId;
    if (!performanceId) return;
    const current = await findPerformanceById(performanceId);
    if (!current?.currentSet) return;
    router.push({
      pathname: '/record',
      params: { performance: performanceId, set: String(current.sets.length - 1) },
    });
  }

  function toggleFilmNext() {
    filmNextRef.current = !filmNextRef.current;
    setFilmNext(filmNextRef.current);
  }

  /**
   * Prépare les signaux du téléphone verrouillé -- l'autorisation se demande
   * au démarrage d'une séance -- et dit une fois pourquoi, s'ils ne peuvent
   * pas marcher : rester muet laissait croire qu'ils marchaient.
   */
  const alertsReported = useRef(false);
  function ensureAlerts() {
    prepareSessionAlerts()
      .then((problem) => {
        if (problem === null || alertsReported.current) return;
        alertsReported.current = true;
        notify(`Signaux téléphone verrouillé indisponibles : ${problem}.`);
      })
      .catch(() => undefined);
  }

  /** La vibration d'un départ, sauf s'il est rattrapé au déverrouillage. */
  function feelOnTime(at?: Date) {
    if (!at || Date.now() - at.getTime() <= LATE_MS) feelStart();
  }

  function afterCountdown(caption: string, go: (at: Date) => Promise<unknown>) {
    if (beforeSetSeconds <= 0) {
      go(new Date());
      return;
    }
    ensureAlerts();
    feelStart();
    setGetReady({ armedAt: new Date(), seconds: beforeSetSeconds, caption, go });
  }

  /**
   * Le signal du repos, à chaque tour de l'anneau.
   *
   * Sur le NOMBRE de tours écoulés, comme le son d'un round sur le nombre de
   * rounds : un rendu qui saute une seconde ne fait pas rater le signal. Et
   * seulement pour un tour franchi SOUS NOS YEUX -- revenir sur l'écran au
   * milieu d'un repos de trois minutes ne doit pas vibrer pour rattraper.
   */
  useEffect(() => {
    if (restStartedAt === null || restSignalChoice === 'none') return;
    const lap = restEvery * 1000;
    let timer: ReturnType<typeof setTimeout>;
    // Programmé pour la fin du tour EN COURS, puis du suivant : un tour déjà
    // passé avant d'arriver sur l'écran ne se rattrape pas.
    const schedule = () => {
      const elapsed = Date.now() - restStartedAt;
      const next = (Math.floor(elapsed / lap) + 1) * lap;
      timer = setTimeout(() => {
        // Hors de l'écran, c'est la notification programmée qui signale :
        // vibrer ici aussi ferait deux signaux pour un seul tour. Et un tour
        // signalé EN RETARD -- au déverrouillage, l'app suspendue -- ne se
        // rattrape pas : la notification l'a déjà dit à l'heure.
        const late = Date.now() - (restStartedAt + next) > LATE_MS;
        if (AppState.currentState === 'active' && !late) {
          feelRestLap();
          if (restSignalChoice === 'sound') playRoundStart();
        }
        schedule();
      }, next - elapsed);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [restStartedAt, restEvery, restSignalChoice]);

  /**
   * Les mêmes signaux, programmés auprès du SYSTÈME pour le téléphone
   * verrouillé (voir session-alerts.ts) : l'application suspendue ne peut
   * plus vibrer d'elle-même. Au premier plan ils se taisent -- ceux de
   * l'écran suffisent.
   */
  const countdownAlerts: SessionAlert[] = [
    ...(readyDeadline !== null && getReady
      ? [{ at: readyDeadline, title: "C'est parti", body: getReady.caption }]
      : []),
    ...(armingDeadline !== null
      ? [{ at: armingDeadline, title: 'Premier round', body: armingName }]
      : []),
  ];
  useSessionAlerts(countdownAlerts, `${readyDeadline}|${armingDeadline}`);

  /**
   * Les tours de repos à venir, une demi-heure au plus : au-delà, on a
   * oublié de démarrer la série, et vibrer encore ne servirait qu'à agacer.
   */
  const restAlerts: SessionAlert[] = [];
  if (restStartedAt !== null && restSignalChoice !== 'none') {
    const lap = restEvery * 1000;
    const laps = Math.floor((30 * 60 * 1000) / lap);
    for (let n = 1; n <= laps; n += 1) {
      restAlerts.push({
        at: restStartedAt + n * lap,
        title: `Repos · ${formatClock((n * lap) / 1000)}`,
        sound: restSignalChoice === 'sound',
      });
    }
  }
  useSessionAlerts(restAlerts, `${restStartedAt}|${restEvery}|${restSignalChoice}`);

  /**
   * Le départ de chaque round d'EMOM, pour le téléphone verrouillé : le seul
   * signal qui compte pendant un EMOM, celui qui dit « c'est reparti ». Le
   * dernier round prévu compris ; au-delà, le choix se fait à l'écran.
   *
   * Il suit le réglage du signal de repos (décidé le 2026-10-08) : vibration
   * seule, son et vibration, ou rien.
   */
  const roundAlerts: SessionAlert[] = [];
  if (emom && emomDeadline !== null && restSignalChoice !== 'none') {
    const interval = emom.intervalSeconds * 1000;
    for (let next = sets.length + 1, at = emomDeadline; next <= emom.totalRounds; next += 1) {
      roundAlerts.push({
        at,
        title: `Round ${next}/${emom.totalRounds}`,
        body: nameOf(activity?.exerciseId ?? ''),
        sound: restSignalChoice === 'sound',
      });
      at += interval;
    }
  }
  useSessionAlerts(
    roundAlerts,
    `${emomDeadline}|${emom?.totalRounds}|${sets.length}|${restSignalChoice}`,
  );

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
   * Alors refermer la roulette relâche la série : il n'y a rien d'autre à
   * régler derrière, et s'arrêter sur le champ demanderait un tap pour rien.
   *
   * Elle ne s'OUVRE plus d'office pour autant (essayé le 2026-09-27, retiré
   * aussitôt). Une roulette qui surgit sur une série qu'on venait juste
   * d'ouvrir cache la série elle-même -- son rang, sa valeur actuelle, ce
   * qu'on est venu vérifier avant de décider. Et elle enlève le choix du
   * geste : les deux crans suffisent souvent, quand on note une seconde de
   * moins que la fois d'avant.
   *
   * Dès qu'une autre mesure ou un second côté existe, la fermeture cesse
   * elle aussi de relâcher la série : il reste un réglage derrière, que la
   * fermeture emporterait.
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
   * son arrêt.
   *
   * Hors EMOM seulement : sous une horloge imposée, le temps d'installer la
   * caméra et de rejoindre le mur appartient au round, qui court pendant
   * (voir la barre du bas).
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
              // La roulette s'ouvre au tap, jamais d'elle-même. La refermer,
              // en revanche, relâche la série quand elle était tout le
              // réglage : à plusieurs mesures, elle n'en est qu'une, et la
              // refermer ramène aux autres au lieu de tout relâcher.
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
    // Une cible ouverte se referme avec : changer d'exercice ou partir sur
    // une série ne laisse pas un réglage ouvert derrière soi.
    setRetargeting(null);
  }

  /**
   * Ouvre ou referme la cible d'une série prévue -- à venir, ou celle en
   * cours, tant qu'elle n'est pas notée.
   */
  function toggleRetarget(index: number) {
    if (retargeting !== null) {
      closeRetarget();
      return;
    }
    closeEditing();
    setRetargeting(index);
  }

  /**
   * Refermer, et demander si le changement vaut aussi pour l'entraînement --
   * seulement s'il y a changement : rouvrir une série pour la regarder ne
   * pose aucune question.
   */
  function closeRetarget() {
    if (retargeting === null) return;
    const index = retargeting;
    setRetargeting(null);
    const today = todayTargets[targetKey(index)];
    const planned = plannedExercise?.sets[index]?.targets;
    if (today && planned && !sameTargets(today, planned)) {
      setAskingScope({ index, targets: today });
    }
  }

  function retarget(measurementId: string, value: number) {
    if (retargeting === null) return;
    const current = plannedTargetsAt(retargeting) ?? {};
    setTodayTargets((all) => ({
      ...all,
      [targetKey(retargeting)]: { ...current, [measurementId]: value },
    }));
  }

  /** Les champs de la cible ouverte : un seul côté, le plan ne les distingue pas. */
  function retargetControls() {
    if (retargeting === null) return null;
    const targets = plannedTargetsAt(retargeting) ?? {};
    return (
      <View className="gap-1">
        <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
          Cible de la série {retargeting + 1}
        </Text>
        <View className="flex-row gap-3">
          {(performance?.measurementIds ?? []).map((id) => (
            <MeasureField
              key={id}
              unit={unitOf(id)}
              measurementId={id}
              value={targets[id] ?? 0}
              onChange={(value) => retarget(id, value)}
              onDone={durationOnly ? closeRetarget : undefined}
            />
          ))}
        </View>
      </View>
    );
  }

  function beginSet(at?: Date) {
    feelOnTime(at);
    // Aucune valeur à mémoriser : le socle les fournit, la saisie locale
    // repart donc de zéro à chaque série.
    return run(async () => {
      closeEditing();
      await startPerformanceSet(at);
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
    if (!interval) return;
    ensureAlerts();

    setArming({
      armedAt: new Date(),
      seconds: setupSeconds,
      intervalSeconds: interval,
      totalRounds: Math.max(1, plannedExercise?.sets.length ?? 1),
      exerciseId: null,
    });
  }

  /**
   * Le rythme prévu part pour de bon, décompte de mise en place écoulé.
   *
   * La série « qui traîne » se juge ICI et non au moment d'armer : le
   * décompte a duré, et une série encore fraîche au tap peut avoir passé sa
   * minute entre-temps.
   */
  function launchPlannedEmom(
    interval: number,
    totalRounds: number,
    at: Date = new Date(),
  ): Promise<unknown> {
    const openedAt = performance?.currentSet?.startedAt;
    const stale = openedAt ? at.getTime() - openedAt.getTime() >= interval * 1000 : false;

    return run(async () => {
      closeEditing();
      if (stale) await abandonPerformanceSet();
      if (!performance?.currentSet || stale) await startPerformanceSet(at);
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
  function beginFree(exerciseId: string, at: Date = new Date()) {
    feelOnTime(at);
    ensureAlerts();
    return startWorkoutSession(null, null, at)
      .then(() => startActivity(exerciseId, null, at))
      .then(() => startPerformanceSet(at))
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
    setConfiguringEmom(false);
    ensureAlerts();
    setArming({
      armedAt: new Date(),
      seconds: setupSeconds,
      intervalSeconds: EMOM_INTERVAL_SECONDS,
      totalRounds: Math.max(1, Math.round(totalSeconds / EMOM_INTERVAL_SECONDS)),
      exerciseId,
    });
  }

  /**
   * La séance libre naît ICI, décompte écoulé -- et non au tap.
   *
   * Une séance DATE de sa première série : la faire naître au tap lui
   * donnerait pour début le moment où l'on range le téléphone, et sa première
   * minute serait déjà entamée quand on monte au mur.
   */
  function launchFreeEmom(
    exerciseId: string,
    totalRounds: number,
    at: Date = new Date(),
  ): Promise<unknown> {
    return startWorkoutSession(null, null, at)
      .then(() => startActivity(exerciseId, null, at))
      .then(() => startPerformanceSet(at))
      .then(reload)
      .then(() => {
        setPending(null);
        setAdjustingStart(false);
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
      onCreate={(name) => {
        // Le geste interrompu -- choisir, ou ajouter -- reprendra au retour
        // avec l'exercice créé (voir l'effet de focus).
        pickedBy.current = onPick;
        router.push({ pathname: '/new-exercise', params: { name, announce: '1' } });
      }}
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
    { label: 'Terminer la séance', icon: 'flag-outline' as const, onPress: finish },
    ...(performance?.currentSet
      ? [{ label: 'Abandonner la série', icon: 'ban-outline' as const, onPress: () => run(abandonPerformanceSet) }]
      : []),
    ...(activity
      ? [
          {
            label: resuming ? 'Reprendre le programme' : "Passer à l'exercice suivant",
            icon: 'play-skip-forward-outline' as const,
            onPress: nextExercise,
          },
        ]
      : []),
    // À tout moment, programme ou pas (décidé le 2026-10-07) : il se fait
    // tout de suite, et le programme reprend ensuite où on l'a laissé.
    { label: 'Ajouter un exercice', icon: 'add-circle-outline' as const, onPress: () => setSheet('pick-exercise') },
    // Uniquement tant que rien n'a encore été fait sur l'exercice en cours :
    // passé la première série, revenir en arrière perdrait ce qui vient
    // d'être fait plutôt que de simplement rattraper le clic de trop.
    ...(activity && session?.previousActivity && performance?.sets.length === 0
      ? [{ label: "Revenir à l'exercice précédent", icon: 'play-skip-back-outline' as const, onPress: previousExercise }]
      : []),
    // Le repos s'enchaîne tout seul après une série ; ici on le commande à
    // la main, pour souffler avant d'attaquer ou pour couper court.
    ...(session?.currentRest
      ? [{ label: 'Arrêter le repos', icon: 'stop-circle-outline' as const, onPress: () => run(stopRest) }]
      : [{ label: 'Démarrer un repos', icon: 'timer-outline' as const, onPress: () => run(startRest) }]),
    { label: 'Annuler la séance', icon: 'close-circle-outline' as const, tone: 'danger' as const, onPress: () => setSheet('confirm-cancel') },
  ];

  /**
   * Commencer pour de bon : la séance est créée, puis sa première série
   * démarrée dans le même geste.
   */
  function begin(plannedWorkoutId: string, scheduledId?: string, at: Date = new Date()) {
    ensureAlerts();
    feelOnTime(at);
    return beginWorkoutSession(plannedWorkoutId, scheduledId ?? null, at)
      .then(reload)
      // Le paramètre a fait son office : le garder ramènerait sur l'écran
      // d'attente si la séance était annulée. Mais il ne se vide qu'APRÈS
      // le rechargement, pour la même raison que ci-dessus.
      .then(() => router.setParams({ plan: '', scheduled: '' }))
      .catch((e) => notify(messageOf(e)));
  }

  const waiting = planParam ? plans.find((candidate) => candidate.id === planParam) : undefined;

  /**
   * Le décompte, posé en DERNIER et sur toute la surface : pendant qu'il
   * tourne on ne lit plus l'écran, on range le téléphone et on se met en
   * place. Le même pour les trois écrans d'où une série peut partir.
   */
  const countdownOverlay =
    arming && armingDeadline !== null ? (
      <SetupCountdown
        deadline={armingDeadline}
        title="Mise en place"
        caption={`${armingName} · le premier round part à zéro`}
        onCancel={() => setArming(null)}
      />
    ) : getReady && readyDeadline !== null ? (
      <SetupCountdown
        deadline={readyDeadline}
        title="Prépare-toi"
        caption={getReady.caption}
        onCancel={() => {
          setGetReady(null);
          filmNextRef.current = false;
          setFilmNext(false);
        }}
        filming={filmNext}
        onToggleFilming={toggleFilmNext}
      />
    ) : null;

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
          subtitle="Rien n'a encore commencé"
          onBack={() => setPending(null)}
          onMenu={() => setSheet('pending-menu')}
        />

        <Text
          className="font-black uppercase text-[32px] leading-[33px] tracking-tighter text-ink dark:text-ink-dark"
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
                onPress={() =>
                  afterCountdown(`${pendingExercise.name} · série 1`, (at) =>
                    beginFree(pendingExercise.id, at),
                  )
                }
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
            { label: "Changer d'exercice", icon: 'swap-horizontal-outline' as const, onPress: () => setSheet('pick-exercise') },
            {
              label: 'Ne pas commencer',
              icon: 'close-outline' as const,
              onPress: () => {
                setSheet('none');
                setPending(null);
              },
            },
          ]}
          onClose={() => setSheet('none')}
        />

        {exercisePicker(choose)}

        {countdownOverlay}
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
            <Card key={`${planned.exerciseId}-${position}`} density="titled" className="gap-2">
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
            </Card>
          ))}
        </ScrollView>

        <View className="px-5 pb-2">
          <Button
            label="Let's go"
            icon="play"
            size="xl"
            onPress={() => {
              const start = (at?: Date) => begin(waiting.id, scheduledParam || undefined, at);
              const first = waiting.exercises[0];
              // Un premier exercice en EMOM a sa propre mise en place, qui
              // part quand on lance le rythme : pas de décompte en double.
              if (!first || first.intervalSeconds) start(new Date());
              else afterCountdown(`${nameOf(first.exerciseId)} · série 1`, start);
            }}
          />
        </View>
        {countdownOverlay}
      </SafeAreaView>
    );
  }

  if (!session) {
    const now = new Date();
    const isToday = (date: Date) => date.toDateString() === now.toDateString();
    const overdue = schedule.filter((entry) => entry.isOverdue(now) && !isToday(entry.scheduledAt));
    const today = schedule.filter((entry) => isToday(entry.scheduledAt));
    const upcoming = schedule.filter((entry) => entry.scheduledAt > now && !isToday(entry.scheduledAt));
    const startable = plans.filter((candidate) => !candidate.isArchived);

    const planNameOf = (id: string) => plans.find((plan) => plan.id === id)?.name ?? id;

    /**
     * Ce qu'un entraînement contient, et quand il a été fait pour la dernière
     * fois : de quoi choisir sans l'ouvrir. `withLastDone` à faux pour ce qui
     * est prévu aujourd'hui -- le choix est déjà fait.
     */
    const contentsOf = (id: string, withLastDone = true): MetaItem[] => {
      const plan = plans.find((candidate) => candidate.id === id);
      if (!plan) return [];
      const sets = plan.exercises.reduce((total, entry) => total + entry.sets.length, 0);
      const items: MetaItem[] = [
        {
          icon: 'barbell-outline' as const,
          label: `${plan.exercises.length} exercice${plan.exercises.length > 1 ? 's' : ''}`,
        },
        { icon: 'layers-outline' as const, label: `${sets} série${sets > 1 ? 's' : ''}` },
      ];
      if (withLastDone) {
        items.push({ icon: 'calendar-outline' as const, label: lastDoneLabel(lastDone.get(id), now) });
      }
      return items;
    };

    /**
     * Ouvrir l'écran d'attente d'un entraînement -- sans créer la séance, qui
     * ne naît qu'au « Let's go ».
     */
    const open = (plannedWorkoutId: string, scheduledId = '') =>
      router.setParams({ plan: plannedWorkoutId, scheduled: scheduledId });

    /**
     * Le menu d'une séance programmée, derrière un seul bouton.
     *
     * « déplacer » et « annuler » vivaient en liens de onze pixels, côte à
     * côte : un pouce visait l'un et touchait l'autre, et l'autre détruisait.
     */
    const menuButton = (entry: ScheduledWorkout) => (
      <Pressable
        onPress={() => setManaging(entry)}
        hitSlop={8}
        accessibilityLabel="Options de la séance programmée"
        className="h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-alt dark:bg-surface-alt-dark"
      >
        <Ionicons name="ellipsis-horizontal" size={18} color={muted} />
      </Pressable>
    );

    const agendaRow = (entry: ScheduledWorkout) => (
      <Card key={entry.id} className="flex-row items-center gap-3">
        <View className="shrink grow gap-0.5">
          <Text className="font-bold text-body text-ink dark:text-ink-dark" numberOfLines={1}>
            {planNameOf(entry.plannedWorkoutId)}
          </Text>
          <Text className="font-mono text-caption text-muted dark:text-muted-dark">
            {formatDateTime(entry.scheduledAt)}
          </Text>
        </View>
        {menuButton(entry)}
      </Card>
    );

    const sectionTitle = (title: string) => (
      <Text className="mt-2 font-bold uppercase text-label text-muted dark:text-muted-dark">
        {title}
      </Text>
    );

    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
        <View className="px-5 pt-4">
          <SectionHeader
            title="Séance"
            subtitle={
              schedule.length > 0
                ? `${schedule.length} entraînement${schedule.length > 1 ? 's' : ''} programmé${schedule.length > 1 ? 's' : ''}`
                : 'Aucune séance en cours'
            }
            // Programmer appartient ICI : c'est la page des séances qui parle
            // du calendrier, pas la fiche d'un entraînement, qui décrit ce
            // qu'il contient.
            action={
              startable.length > 0
                ? { label: 'Programmer', onPress: () => setPlanning({ plan: null }) }
                : undefined
            }
          />
        </View>

        {/* Le lanceur. Tout ce qui démarre une séance est ici, à un tap :
            ce qui est prévu aujourd'hui d'abord, puis ce qui traîne, puis
            n'importe lequel de tes entraînements, ou rien de prévu du tout.
            L'accueil y mène, au lieu d'atterrir sur une liste de rendez-vous
            avec le vrai choix relégué en bas. */}
        <ScrollView
          contentContainerClassName="grow gap-3 px-5 pb-6"
          keyboardShouldPersistTaps="handled"
        >
          {today.map((entry) => (
            <Card key={entry.id} density="accent" className="gap-3">
              <View className="flex-row items-start justify-between gap-3">
                <View className="shrink gap-0.5">
                  <Text className="font-bold uppercase text-label text-primary-ink dark:text-primary-ink-dark">
                    Prévu aujourd'hui
                  </Text>
                  <Text
                    className="font-extrabold text-heading text-ink dark:text-ink-dark"
                    numberOfLines={2}
                  >
                    {planNameOf(entry.plannedWorkoutId)}
                  </Text>
                  <MetaLine items={contentsOf(entry.plannedWorkoutId, false)} />
                </View>
                {menuButton(entry)}
              </View>
              <Button
                label="Démarrer"
                size="lg"
                onPress={() => open(entry.plannedWorkoutId, entry.id)}
              />
            </Card>
          ))}

          {/* En retard, jamais "manqué" : la séance reste à faire. */}
          {overdue.length > 0 && (
            <>
              {sectionTitle('En retard')}
              {overdue.map(agendaRow)}
            </>
          )}

          {sectionTitle('Démarrer')}

          {/* Sans programme : l'exercice d'abord, le reste suit. */}
          <Pressable onPress={() => setSheet('pick-exercise')}>
            <Card className="flex-row items-center gap-3">
              <View className="h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary dark:bg-primary-dark">
                <Ionicons name="flash" size={20} color={onPrimary} />
              </View>
              <View className="shrink grow gap-0.5">
                <Text className="font-bold text-body text-ink dark:text-ink-dark">Séance libre</Text>
                <Text className="text-small text-muted dark:text-muted-dark">
                  Choisis un exercice et vas-y, sans programme.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={muted} />
            </Card>
          </Pressable>

          {startable.map((plan) => (
            <Pressable key={plan.id} onPress={() => open(plan.id)}>
              <Card className="flex-row items-center gap-3">
                {/* Le vert pâle de la séance libre, en plus discret : le gris
                    sur la carte sombre se voyait à peine. */}
                <View className="h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-soft dark:bg-primary-soft-dark">
                  <Ionicons name="clipboard-outline" size={20} color={primaryInk} />
                </View>
                <View className="shrink grow gap-0.5">
                  <Text
                    className="font-bold text-body text-ink dark:text-ink-dark"
                    numberOfLines={1}
                  >
                    {plan.name}
                  </Text>
                  <MetaLine items={contentsOf(plan.id)} />
                </View>
                <Ionicons name="chevron-forward" size={18} color={muted} />
              </Card>
            </Pressable>
          ))}

          {startable.length === 0 && (
            <EmptyState
              inline
              title="Aucun entraînement"
              description="Un entraînement regroupe des exercices et leurs séries cibles, pour les refaire d'une séance à l'autre."
              actionLabel="Créer un entraînement"
              onAction={() => router.push('/new-workout')}
            />
          )}

          {upcoming.length > 0 && (
            <>
              {sectionTitle('À venir')}
              {upcoming.map(agendaRow)}
            </>
          )}
        </ScrollView>

        <Sheet
          visible={managing !== null}
          title={managing ? planNameOf(managing.plannedWorkoutId) : ''}
          description={managing ? `Programmée ${formatDateTime(managing.scheduledAt)}` : undefined}
          actions={
            managing
              ? [
                  {
                    label: 'Démarrer maintenant',
                    icon: 'play-outline' as const,
                    onPress: () => open(managing.plannedWorkoutId, managing.id),
                  },
                  {
                    label: 'Déplacer',
                    icon: 'calendar-outline' as const,
                    onPress: () => setMoving(managing),
                  },
                  {
                    label: 'Annuler cette séance programmée',
                    icon: 'close-circle-outline' as const,
                    tone: 'danger',
                    onPress: () => run(() => cancelScheduledWorkout(managing)),
                  },
                ]
              : []
          }
          onClose={() => setManaging(null)}
        />

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

        {/* Programmer se fait en deux temps : quel entraînement, puis quand. */}
        <Sheet
          visible={planning !== null && planning.plan === null}
          title="Programmer un entraînement"
          description="Il sera à faire à la date choisie, sans démarrer maintenant."
          searchPlaceholder="Chercher un entraînement"
          actions={startable.map((candidate) => ({
            label: candidate.name,
            icon: 'clipboard-outline' as const,
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
      ? `Exercice ${activity.plannedPosition + 1}/${plan.exercises.length} · ${plannedExercise?.intervalSeconds ? 'round' : 'série'} ${nextSetIndex + (performance?.currentSet ? 0 : 1)} sur ${plannedExercise?.sets.length ?? '—'}`
      : plan
        ? // Ajouté en route : il n'a pas de rang dans le programme, mais
          // ses séries se comptent comme les autres.
          `Hors programme · série ${nextSetIndex + (performance?.currentSet ? 0 : 1)}`
        : 'Séance libre';

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background px-5 pb-2 pt-4 dark:bg-background-dark">
      <SessionHeader
        workoutName={plan ? plan.name : 'Séance libre'}
        position={position}
        progress={
          plan
            ? activity?.plannedPosition != null
              ? {
                  segments: plan.exercises.length,
                  current: activity.plannedPosition,
                  fraction: totalSets > 0 ? completedCount / totalSets : 0,
                }
              : // Un exercice ajouté ne remplit aucun segment : la barre
                // montre ce qui est fait du programme, et où il reprendra.
                {
                  segments: plan.exercises.length,
                  current: nextPosition ?? plan.exercises.length,
                  fraction: 0,
                }
            : undefined
        }
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
          // En style direct, et non en classe : la version web n'applique
          // pas les classes d'une vue animée, et l'exercice doit occuper
          // toute la hauteur pour que ses boutons restent en bas.
          style={{ flex: 1 }}
        >
          {/* De l'air sous la barre de progression : collé à elle, le nom
              se lisait comme sa légende. Un cran plus petit pour rendre la
              place prise -- l'anneau, en dessous, vit de ce qui reste. */}
          <Text
            className="mt-4 font-black uppercase text-[32px] leading-[33px] tracking-tighter text-ink dark:text-ink-dark"
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
            <View className="flex-row items-center gap-1">
              <Text className="font-mono text-small text-muted dark:text-muted-dark">
                {showDetail ? 'Réduire' : 'Détail'}
              </Text>
              <Ionicons name={showDetail ? 'chevron-up' : 'chevron-down'} size={14} color={muted} />
            </View>
          </Pressable>

          {showDetail ? (
            <View className="shrink grow-0">
            <ScrollView
              ref={listRef}
              key={activity.performanceId ?? 'none'}
              keyboardShouldPersistTaps="handled"
              // Quatre lignes, pas une hauteur en pourcentage : au-delà, la
              // liste mangeait l'anneau et les boutons sur les petits écrans.
              // Ce qui dépasse se fait défiler.
              style={{ maxHeight: 4 * (SET_ROW_HEIGHT + SET_ROW_GAP) }}
              // Celle d'Android est écartée au profit de la nôtre : elle
              // n'apparaît qu'en défilant -- or le problème est de ne pas
              // savoir qu'on peut défiler -- et sa couleur vient du thème
              // natif, qu'on ne peut pas atteindre d'ici.
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={16}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { y: listOffset } } }],
                { useNativeDriver: false },
              )}
              onLayout={({ nativeEvent }) =>
                setListBox((current) =>
                  current.visible === nativeEvent.layout.height
                    ? current
                    : { ...current, visible: nativeEvent.layout.height },
                )
              }
              onContentSizeChange={(_, height) =>
                setListBox((current) =>
                  current.content === height ? current : { ...current, content: height },
                )
              }
              // L'écart vient de la CONSTANTE, pas d'une classe qui dit le
              // même nombre ailleurs : c'est elle qui sert à calculer la
              // hauteur ci-dessus, et les deux se contrediraient le jour où
              // l'une change sans l'autre -- ce qui venait d'arriver.
              //
              // À droite, la place de la barre : les lignes ne passent pas
              // dessous.
              contentContainerStyle={{
                gap: SET_ROW_GAP,
                paddingLeft: 4,
                paddingRight: 10,
                paddingTop: 2,
                paddingBottom: 4,
              }}
            >
              {sets.map((set, index) => (
                <SetRow
                  key={`${activity.performanceId}-${index}`}
                  index={index + 1}
                  status={statusOf(set.status)}
                  // Une série déjà enregistrée peut être rouverte pour
                  // corriger ce qu'on a réellement fait.
                  onPress={
                    set.status === 'IN_PROGRESS'
                      ? // En cours, elle n'a encore rien noté : c'est sa
                        // CIBLE qui se règle, comme pour une série à venir.
                        plannedExercise?.sets[index] && !emom
                        ? () => toggleRetarget(index)
                        : undefined
                      : () => toggleEditing(index)
                  }
                  selected={editing === index || retargeting === index}
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
              {upcoming.map((set, index) => (
                <SetRow
                  key={`${activity.performanceId}-planned-${index}`}
                  index={nextSetIndex + index + 1}
                  status="planned"
                  values={formatPlanned(set.targets)}
                  // La cible d'une série à venir se change comme on corrige
                  // une série faite : en tapant sa ligne.
                  onPress={
                    plannedExercise && !emom ? () => toggleRetarget(nextSetIndex + index) : undefined
                  }
                  selected={retargeting === nextSetIndex + index}
                />
              ))}
            </ScrollView>
            <ScrollHint
              offset={listOffset}
              visible={listBox.visible}
              content={listBox.content}
            />
            </View>
          ) : (
            <ScrollView
              ref={chipsRef}
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
                  onPress={
                    set.status === 'IN_PROGRESS'
                      ? plannedExercise?.sets[index] && !emom
                        ? () => toggleRetarget(index)
                        : undefined
                      : () => toggleEditing(index)
                  }
                  selected={editing === index || retargeting === index}
                  // La série ajustée montre la valeur en cours, sans attendre
                  // le prochain rechargement.
                  values={formatShort(index === lastSetIndex && !isPast(set) ? shown : set.values) || '—'}
                />
              ))}
              {upcoming.map((set, index) => (
                <SetChip
                  key={`${activity.performanceId}-planned-${index}`}
                  index={nextSetIndex + index + 1}
                  status="planned"
                  values={formatPlannedShort(set.targets)}
                  onPress={
                    plannedExercise && !emom ? () => toggleRetarget(nextSetIndex + index) : undefined
                  }
                  selected={retargeting === nextSetIndex + index}
                />
              ))}
            </ScrollView>
          )}

          {emom ? (
            /* L'anneau ne demande rien : il montre juste ce qu'il reste. Le
               round avance à l'horloge, jamais au tap (voir l'effet d'avance
               automatique plus haut).

               Et c'est le VIDE de l'écran : y taper referme la correction en
               cours, exactement comme pendant le repos. Rien à apprendre, et
               donc pas de bouton pour le dire.

               Pendant qu'on corrige, l'anneau s'efface et laisse sa place :
               les champs s'inscrivent en bas, là où ils s'inscrivent hors
               EMOM. Ils ont d'abord vécu dans une feuille par-dessus l'écran,
               puis ici même à la place de l'anneau, et dans les deux cas ils
               ne recevaient rien sur Android. Le seul endroit dont on SAIT
               qu'il répond est celui qui sert pendant le repos : c'est donc
               celui-là qui sert aussi ici. Un emplacement qui marche vaut
               mieux qu'une explication de pourquoi l'autre ne marchait pas. */
            <Pressable
              className="flex-1 items-center justify-center"
              onPress={() => {
                if (editing !== null) toggleEditing(editing);
                closeRetarget();
              }}
              // La zone ne dépend pas de ce qu'elle contient -- `flex-1` prend
              // ce qui RESTE --, donc la mesurer pour dimensionner l'anneau ne
              // boucle pas. On ne réécrit que si elle a bougé, par prudence.
              onLayout={({ nativeEvent }) => {
                const { width, height } = nativeEvent.layout;
                setRingBox((current) =>
                  current &&
                  Math.abs(current.width - width) < 1 &&
                  Math.abs(current.height - height) < 1
                    ? current
                    : { width, height },
                );
              }}
            >
              {editing !== null && editedSet ? (
                <View className="items-center gap-0.5">
                  <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
                    Round {editing + 1}
                  </Text>
                  {/* L'anneau n'est plus là pour le dire : une ligne rappelle
                      que l'horloge n'attend pas qu'on ait fini de noter. */}
                  <Text className="font-mono text-caption text-muted dark:text-muted-dark">
                    {emom.pausedAt ? (
                      'EMOM en pause'
                    ) : isFinalEmomRound ? (
                      'Dernier round'
                    ) : (
                      <EmomLeft deadline={emomDeadline} />
                    )}
                  </Text>
                </View>
              ) : (
                <>
                  <EmomRing
                    emom={emom}
                    roundStartedAt={emomRoundStartedAt}
                    // Le rang du round s'écrit SOUS l'anneau : sa ligne et
                    // son écart sont pris sur le même budget, sinon c'est lui
                    // qui passe sous la barre du bas.
                    size={ringSizeIn(ringBox, ROUND_LABEL)}
                  />
                  <Text className="pt-3 font-bold uppercase text-label text-muted dark:text-muted-dark">
                    Round {Math.min(sets.length, emom.totalRounds)}/{emom.totalRounds}
                    {emom.pausedAt ? ' · en pause' : ''}
                  </Text>
                </>
              )}
            </Pressable>
          ) : (
            /* Le chrono occupe le centre de l'écran pendant la récupération.

               Et c'est le VIDE de l'écran : y taper referme l'ajustement en
               cours, comme retaper la série elle-même. Rien à apprendre, et
               donc pas de bouton pour le dire. */
            <Pressable
              className="flex-1 items-center justify-center"
              onPress={() => {
                if (editing !== null) toggleEditing(editing);
                closeRetarget();
              }}
              // Mesurée comme celle de l'anneau d'un EMOM, pour la même
              // raison : l'anneau du repos prend la place qu'il reste.
              onLayout={({ nativeEvent }) => {
                const { width, height } = nativeEvent.layout;
                setRingBox((current) =>
                  current &&
                  Math.abs(current.width - width) < 1 &&
                  Math.abs(current.height - height) < 1
                    ? current
                    : { width, height },
                );
              }}
            >
              {/* La série en cours respire au centre : l'écran dit qu'elle
                  tourne, et depuis combien de temps. */}
              {!resting && liveSetStartedAt !== null && editing === null && retargeting === null && (
                <SetPulse
                  startedAt={liveSetStartedAt}
                  values={format(shown)}
                  size={ringSizeIn(ringBox)}
                />
              )}
              {/* Pendant qu'on corrige une série, les champs prennent la
                  place : le chrono seul suffit à dire le repos. */}
              {resting &&
                (editing !== null || retargeting !== null ? (
                  <RestClock startedAt={restStartedAt ?? Date.now()} />
                ) : (
                  <>
                    <RestRing
                      startedAt={restStartedAt ?? Date.now()}
                      lapSeconds={restEvery}
                      // La ligne de l'exercice suivant se loge sous l'anneau,
                      // sur le même budget : elle ne le pousse pas dehors.
                      size={ringSizeIn(ringBox, nextName ? NEXT_LABEL : 0)}
                    />
                    {/* Ce qui vient ensuite, en petit : de quoi préparer la
                        barre ou les haltères pendant qu'on souffle, sans
                        disputer l'oeil au chrono. */}
                    {nextName && (
                      <Text
                        className="pt-3 text-small text-muted dark:text-muted-dark"
                        numberOfLines={1}
                      >
                        Exercice suivant · {nextName}
                      </Text>
                    )}
                  </>
                ))}
            </Pressable>
          )}

          <View className="gap-3 pb-2">
            {/* Les champs s'inscrivent ICI, que l'horloge tourne ou non :
                sous le chrono pendant le repos, sous l'anneau effacé pendant
                un EMOM. Un seul emplacement, donc un seul comportement à
                vérifier -- et c'est celui dont on sait qu'il répond. */}
            {editing !== null && editedSet && setControls()}
            {retargetControls()}

            {editing === null &&
              retargeting === null &&
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
                  /* Un round ne se filme pas -- retiré le 2026-09-28.
                     Installer la caméra, la lancer, rejoindre le mur : le
                     temps que ça prend appartient au round, qui court
                     pendant. On a essayé de faire coïncider les deux horloges
                     (le round partait à l'instant où l'enregistrement
                     démarre) et ça marchait, mais ça demandait trop de gestes
                     pour ce que ça rend. Le sujet est remis à plus tard,
                     quand le flux d'une séance filmée sera clair.

                     Une série ORDINAIRE se filme toujours : c'est l'horloge
                     imposée qui pose problème, pas la caméra. */
                  <Button
                    label="Fini"
                    icon="checkmark"
                    size="lg"
                    onPress={() => run(() => completePerformanceSet(shown))}
                  />
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
                    onPress={() =>
                      afterCountdown(
                        `${nameOf(activity.exerciseId)} · série ${nextSetIndex + 1}${
                          plannedExercise && !plannedDone ? ` sur ${plannedExercise.sets.length}` : ''
                        }`,
                        (at) => beginSet(at),
                      )
                    }
                  />
                  {plannedDone && (
                    // Une flèche, là où le round suivant porte un saut de
                    // lecture : on avance dans le programme, on ne coupe pas
                    // court à une minute.
                    <Button
                      label={
                        resuming
                          ? resumeName
                            ? `Reprendre · ${resumeName}`
                            : 'Reprendre le programme'
                          : 'Exercice suivant'
                      }
                      // En toutes lettres quand on revient au programme : la
                      // flèche seule ne dirait pas OÙ l'on revient.
                      icon={resuming ? undefined : 'arrow-forward'}
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
          { label: 'Terminer la séance', icon: 'flag-outline' as const, onPress: finish },
          { label: 'Ajouter un exercice', icon: 'add-circle-outline' as const, onPress: () => setSheet('pick-exercise') },
        ]}
        onClose={() => setSheet('none')}
      />
      {exercisePicker(addExercise)}
      {/* Demandé à chaque fois (décidé le 2026-10-08) : ni l'un ni l'autre
          n'est toujours le bon -- un jour sans ne doit pas réécrire le
          programme, un vrai progrès doit pouvoir y rester. Refermer sans
          choisir garde le changement pour aujourd'hui seulement. */}
      <Sheet
        visible={askingScope !== null}
        title="Garder ce changement ?"
        description={
          askingScope
            ? `Série ${askingScope.index + 1} : ${formatPlanned(askingScope.targets)}`
            : undefined
        }
        actions={[
          {
            label: "Seulement aujourd'hui",
            icon: 'today-outline' as const,
            onPress: () => setAskingScope(null),
          },
          {
            label: "Aussi dans l'entraînement",
            icon: 'save-outline' as const,
            onPress: () => {
              const scope = askingScope;
              setAskingScope(null);
              if (!scope || !plan || activity?.plannedPosition == null) return;
              const position = activity.plannedPosition;
              run(async () => {
                await retargetPlannedSet({
                  workoutId: plan.id,
                  position,
                  setIndex: scope.index,
                  targets: scope.targets,
                });
                notify("L'entraînement est mis à jour.", 'success');
              });
            },
          },
        ]}
        onClose={() => setAskingScope(null)}
      />
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
            icon: 'close-circle-outline' as const,
            tone: 'danger',
            onPress: () => run(cancelWorkoutSession),
          },
        ]}
        onClose={() => setSheet('none')}
      />

      {countdownOverlay}
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

/** Deux cibles disent-elles la même chose ? L'ordre des mesures ne compte pas. */
function sameTargets(a: TargetValues, b: TargetValues): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => (a[key] ?? 0) === (b[key] ?? 0));
}

/*
 * Les chiffres qui défilent, chacun avec SA propre horloge : eux seuls se
 * redessinent à chaque battement, et non l'écran entier (voir `useNow`).
 */

/** L'anneau d'un round d'EMOM, qui se vide jusqu'au suivant. */
function EmomRing({
  emom,
  roundStartedAt,
  size,
}: {
  emom: Emom;
  roundStartedAt: Date | null;
  size: number;
}) {
  // Quatre fois par seconde : le battement n'est pas calé sur l'horloge, et
  // une seconde jamais affichée se verrait comme un saut.
  const now = useNow(250, !emom.pausedAt);
  const remaining = roundStartedAt
    ? emomStatus({
        intervalSeconds: emom.intervalSeconds,
        totalRounds: emom.totalRounds,
        round: 0,
        roundStartedAt,
        // En pause, l'anneau se fige à l'instant du tap.
        now: emom.pausedAt ?? new Date(now),
      }).remainingSeconds
    : emom.intervalSeconds;

  return <CountdownRing remainingSeconds={remaining} totalSeconds={emom.intervalSeconds} size={size} />;
}

/** « Prochain round dans 12 s », pendant qu'on corrige un round. */
function EmomLeft({ deadline }: { deadline: number | null }) {
  const now = useNow(250, deadline !== null);
  const left = deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000));
  return <>{`Prochain round dans ${left} s`}</>;
}

/** Le chrono du repos, en petit, pendant qu'on corrige une série. */
function RestClock({ startedAt }: { startedAt: number }) {
  const now = useNow(250);
  return <Timer seconds={Math.max(0, Math.floor((now - startedAt) / 1000))} />;
}
