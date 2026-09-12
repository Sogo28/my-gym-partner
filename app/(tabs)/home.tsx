import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Goal } from '../../src/domain/goal/goal';
import type { PlannedWorkout } from '../../src/domain/planned-workout/planned-workout';
import type { ScheduledWorkout } from '../../src/domain/scheduling/scheduled-workout';
import type { WorkoutSession } from '../../src/domain/workout-session/workout-session';
import { findAll as findAllPlans } from '../../src/infra/planned-workout-repository';
import { findSessionsOn, type DaySession } from '../../src/infra/session-history';
import { findActive } from '../../src/infra/workout-session-repository';
import { BodyMap } from '../../src/ui/body-map';
import { highlight } from '../../src/ui/body-slugs';
import { Button } from '../../src/ui/button';
import { Card } from '../../src/ui/card';
import { GoalCard } from '../../src/ui/goal-card';
import { dayLabel, formatDateTime, formatTime } from '../../src/ui/format';
import { useNotifications } from '../../src/ui/notifications';
import { messageOf } from '../../src/ui/message';
import { SectionHeader } from '../../src/ui/screen-header';
import { evaluateGoal, listGoals, type GoalEvaluation } from '../../src/use-cases/goal-actions';
import { listMetrics } from '../../src/use-cases/body-actions';
import {
  findAll as findAllExercises,
  findAllMeasurements,
} from '../../src/infra/exercise-repository';
import type { Exercise } from '../../src/domain/exercise/exercise';
import type { GoalSubject } from '../../src/domain/goal/goal';
import type { Measurement } from '../../src/domain/exercise/measurement';
import type { BodyMetric } from '../../src/domain/body/body-metric';
import { listSchedule, scheduleWorkout } from '../../src/use-cases/scheduling-actions';
import { DatePickerSheet } from '../../src/ui/date-picker';
import { Sheet } from '../../src/ui/sheet';
import {
  startOfDay,
  startOfWeek,
  summarizeDay,
  summarizeWeek,
  weekDays,
  workedDays,
  type MuscleSummary,
} from '../../src/use-cases/week-summary';
import { WeekStrip } from '../../src/ui/week-strip';

const EMPTY: MuscleSummary = { primaryMuscleIds: [], secondaryMuscleIds: [], exerciseCount: 0 };

/**
 * L'accueil : ce que tu fais maintenant, ce que la semaine a produit, ce qui
 * vient, et où tu vas.
 *
 * Quatre blocs, dans cet ordre, et pas un de plus : au-delà, un accueil
 * devient un tiroir -- et un tiroir se vide en le regardant, jamais en s'en
 * servant. Aucune statistique non plus : à deux séances par semaine, les
 * moyennes ne disent rien que le schéma ne dise mieux.
 */
export default function HomeScreen() {
  const { notify } = useNotifications();
  const router = useRouter();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [week, setWeek] = useState<MuscleSummary>(EMPTY);
  const [done, setDone] = useState<Date[]>([]);
  /** Le jour regardé seul, ou null pour la semaine entière. */
  const [day, setDay] = useState<Date | null>(null);
  const [dayWork, setDayWork] = useState<MuscleSummary>(EMPTY);
  /** Les séances réellement FAITES le jour regardé. */
  const [daySessions, setDaySessions] = useState<DaySession[]>([]);
  const [schedule, setSchedule] = useState<ScheduledWorkout[]>([]);
  const [plans, setPlans] = useState<PlannedWorkout[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [evaluations, setEvaluations] = useState<Map<string, GoalEvaluation | null>>(new Map());
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  /** L'étape de la planification : choisir l'entraînement, puis sa date. */
  const [planning, setPlanning] = useState<'none' | 'workout' | 'date'>('none');
  const [chosen, setChosen] = useState<PlannedWorkout | null>(null);

  useFocusEffect(
    useCallback(() => {
      Promise.all([
        findActive(),
        summarizeWeek(new Date()),
        listSchedule(),
        findAllPlans(),
        listGoals(),
        workedDays(new Date()),
        findAllMeasurements(),
        listMetrics(),
        findAllExercises(),
      ])
        .then(
          ([
            active,
            summary,
            allSchedule,
            allPlans,
            allGoals,
            days,
            allMeasurements,
            allMetrics,
            allExercises,
          ]) => {
          setSession(active);
          setWeek(summary);
          setDone(days);
          // Toutes, statuts compris : une séance FAITE aujourd'hui doit se
          // dire, là où la filtrer ferait afficher « rien de prévu ».
          setSchedule(allSchedule);
          setPlans(allPlans);
          setMeasurements(allMeasurements);
          setMetrics(allMetrics);
          setExercises(allExercises);

          const running = allGoals.filter((goal) => goal.status === 'ACTIVE');
          setGoals(running);
            return Promise.all(running.map((goal) => evaluateGoal(goal))).then((results) => {
              setEvaluations(new Map(running.map((goal, index) => [goal.id, results[index]])));
            });
          },
        )
        .catch((e) => notify(messageOf(e)));
    }, []),
  );

  /**
   * Ce qui a été fait le jour regardé.
   *
   * À part du reste, et rechargé quand le jour change comme à chaque
   * affichage : une séance vient peut-être de s'y ajouter.
   */
  useFocusEffect(
    useCallback(() => {
      findSessionsOn(day ?? new Date())
        .then(setDaySessions)
        .catch((e) => notify(messageOf(e)));
    }, [day]),
  );

  const planNameOf = (id: string) => plans.find((plan) => plan.id === id)?.name ?? id;

  /**
   * L'unité de ce qui est évalué : celle d'une mesure de performance, ou
   * celle d'une mensuration -- une condition sur un tour de cuisse s'exprime
   * en centimètres.
   */
  /** Ce que l'étape en cours vise : un exercice, ou une mensuration. */
  const subjectName = (subject: GoalSubject) =>
    subject.kind === 'exercise'
      ? (exercises.find((exercise) => exercise.id === subject.exerciseId)?.name ??
        subject.exerciseId)
      : (metrics.find((metric) => metric.id === subject.metricId)?.name ?? subject.metricId);

  const unitOf = (id: string | null) =>
    id === null
      ? ''
      : (measurements.find((m) => m.id === id)?.unit ??
        metrics.find((m) => m.id === id)?.unit ??
        '');

  // La semaine en cours seulement : ce qui vient après appartient à la
  // suivante, et l'accueil ne raconte qu'aujourd'hui.
  const monday = startOfWeek(new Date());
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 7);
  const thisWeek = schedule
    .filter((entry) => entry.status !== 'CANCELLED')
    .filter((entry) => entry.scheduledAt < sunday)
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  /**
   * Le jour choisi remplace la semaine dans le schéma.
   *
   * Il est chargé à la demande : sept résumés calculés d'avance, pour un seul
   * regardé, seraient sept lectures de la base pour rien.
   */
  function select(chosen: Date | null) {
    setDay(chosen);
    if (!chosen) return;
    summarizeDay(chosen)
      .then(setDayWork)
      .catch((e) => notify(messageOf(e)));
  }

  const shown = day ? dayWork : week;
  const worked = highlight(shown.primaryMuscleIds, shown.secondaryMuscleIds);

  const today = startOfDay(new Date());
  const schedulable = plans.filter((plan) => !plan.isArchived);

  /**
   * Le jour dont on parle : celui qu'on regarde dans le calendrier, à défaut
   * aujourd'hui. Le bloc suit la sélection, sinon taper mardi montrerait les
   * muscles de mardi au-dessus de la séance d'aujourd'hui.
   */
  const shownDay = day ?? today;
  /** Un jour passé ne se planifie plus : il se lit. */
  const past = shownDay.getTime() < today.getTime();
  /**
   * Ce qui était PRÉVU ce jour-là et n'a pas été fait.
   *
   * Une intention exécutée est déjà racontée par la séance qu'elle a
   * produite : la redire ici ferait deux cartes pour une seule séance.
   */
  const plannedThatDay = thisWeek.filter(
    (entry) =>
      entry.status !== 'EXECUTED' &&
      startOfDay(entry.scheduledAt).getTime() === shownDay.getTime(),
  );
  const strip = weekDays(new Date()).map((date) => ({
    date,
    worked: done.some((entry) => entry.getTime() === date.getTime()),
    scheduled: thisWeek.some(
      (entry) =>
        entry.status === 'SCHEDULED' &&
        startOfDay(entry.scheduledAt).getTime() === date.getTime(),
    ),
    today: date.getTime() === today.getTime(),
  }));

  /**
   * Aller faire la séance prévue -- sans la créer.
   *
   * Une séance commence à sa première série : partir d'ici ne fait que
   * l'ouvrir à l'écran, et changer d'avis ne laisse rien derrière soi.
   */
  function start(plannedWorkoutId: string, scheduledId: string) {
    router.push({
      pathname: '/session',
      params: { plan: plannedWorkoutId, scheduled: scheduledId },
    });
  }

  /**
   * Programmer : l'entraînement d'abord, la date ensuite.
   *
   * La date proposée est le jour REGARDÉ dans le calendrier, à défaut
   * aujourd'hui : venir de taper jeudi puis se voir proposer lundi ferait
   * refaire à la main ce qu'on vient de dire.
   */
  async function planFor(at: Date) {
    const plan = chosen;
    setPlanning('none');
    setChosen(null);
    if (!plan) return;

    try {
      await scheduleWorkout({ plannedWorkoutId: plan.id, at });
      setSchedule((await listSchedule()).filter((entry) => entry.status === 'SCHEDULED'));
    } catch (e) {
      notify(messageOf(e));
    }
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-5 pt-4">
        <SectionHeader
          title="Accueil"
          subtitle={
            week.exerciseCount === 0
              ? 'aucun exercice travaillé cette semaine'
              : `${week.exerciseCount} exercice${week.exerciseCount > 1 ? 's' : ''} travaillé${week.exerciseCount > 1 ? 's' : ''} cette semaine`
          }
        />
      </View>

      <ScrollView contentContainerClassName="gap-5 px-5 pb-10" keyboardShouldPersistTaps="handled">

        {/* Ce qui a été fait -- la semaine, ou le jour qu'on a choisi. */}
        <View className="gap-3">
          <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
            {day
              ? `Travaillé ${dayLabel(day, new Date())}`
              : 'Travaillé cette semaine'}
          </Text>

          {/* Le schéma reste, même vide : une silhouette sans couleur dit
              « rien ce jour-là » sans faire sauter la page, et garde le
              calendrier à la même place d'un jour à l'autre. */}
          <BodyMap parts={worked} scale={0.62} />

          <WeekStrip days={strip} selected={day} onSelect={select} />

          {/* Sous le calendrier : on regarde d'abord ce qui a été fait, on
              décide ensuite. La séance en cours prend la même place -- c'est
              la suite du même geste, pas une autre décision. */}
          {session ? (
            <Card density="accent" className="mt-1 gap-2">
              <Text className="font-bold uppercase text-label text-primary-ink dark:text-primary-ink-dark">
                Séance en cours
              </Text>
              <Text className="font-mono text-small text-muted dark:text-muted-dark">
                commencée à {formatDateTime(session.startedAt)}
              </Text>
              <Button label="Reprendre" size="md" onPress={() => router.push('/session')} />
            </Card>
          ) : (
            <Button
              label="Démarrer une séance"
              size="lg"
              className="mt-1"
              onPress={() => router.push('/session')}
            />
          )}
        </View>

        {/* Ce qui est prévu AUJOURD'HUI, et rien de plus : le reste de la
            semaine se lit déjà dans les carrés du calendrier. Pendant une
            séance, le bloc disparaît : ce qu'il proposerait est en cours. */}
        {!session && (
        <View className="gap-2">
          <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
            {dayLabel(shownDay, new Date())}
          </Text>

          {daySessions.length === 0 && plannedThatDay.length === 0 ? (
            <Card density="titled" className="gap-2">
              <Text className="text-small text-muted dark:text-muted-dark">
                {past
                  ? `Aucune séance faite ${dayLabel(shownDay, new Date())}.`
                  : schedulable.length === 0
                    ? "Aucun entraînement à programmer pour l'instant. Un entraînement regroupe des exercices et leurs séries cibles."
                    : `Aucune séance prévue ${dayLabel(shownDay, new Date())}.`}
              </Text>

              {/* Rien à proposer sur un jour passé : on ne programme pas
                  hier. Et sans entraînement, « Planifier » n'ouvrirait qu'une
                  liste vide. */}
              {!past && (
                <Button
                  label={
                    schedulable.length === 0 ? 'Créer un entraînement' : 'Planifier une séance'
                  }
                  variant="secondary"
                  size="md"
                  onPress={() =>
                    schedulable.length === 0
                      ? router.push('/new-workout')
                      : setPlanning('workout')
                  }
                />
              )}
            </Card>
          ) : (
            <>
              {/* Ce qui a été FAIT passe devant ce qui était prévu : c'est ce
                  qu'on vient voir, et une séance libre n'existe qu'ici --
                  aucun calendrier ne l'a jamais connue. */}
              {daySessions.map((entry) => (
                <Pressable
                  key={entry.id}
                  onPress={() =>
                    router.push({ pathname: '/session-summary', params: { id: entry.id } })
                  }
                >
                  <Card density="titled" className="gap-2">
                    <View className="flex-row items-start justify-between gap-3">
                      <Text
                        className="shrink font-extrabold text-lead text-ink dark:text-ink-dark"
                        numberOfLines={1}
                      >
                        {entry.plannedWorkoutId
                          ? planNameOf(entry.plannedWorkoutId)
                          : 'Séance libre'}
                      </Text>
                      <Text className="font-mono text-small text-muted dark:text-muted-dark">
                        {formatTime(entry.startedAt)}
                      </Text>
                    </View>
                    <Text className="text-small text-success dark:text-success-dark">
                      Séance faite · {entry.completedSets} série
                      {entry.completedSets > 1 ? 's' : ''}
                    </Text>
                  </Card>
                </Pressable>
              ))}

              {plannedThatDay.map((entry) => (
                <Card key={entry.id} density="titled" className="gap-2">
                  <View className="flex-row items-start justify-between gap-3">
                    <Text
                      className="shrink font-extrabold text-lead text-ink dark:text-ink-dark"
                      numberOfLines={1}
                    >
                      {planNameOf(entry.plannedWorkoutId)}
                    </Text>
                    <Text className="font-mono text-small text-muted dark:text-muted-dark">
                      {formatDateTime(entry.scheduledAt)}
                    </Text>
                  </View>

                  {past ? (
                    // Prévue et non faite, et le jour est passé : le dire, sans
                    // proposer de la démarrer -- elle ne le serait plus ce
                    // jour-là de toute façon.
                    <Text className="text-small text-muted dark:text-muted-dark">
                      Séance non faite.
                    </Text>
                  ) : (
                    <Button
                      label="Démarrer"
                      size="md"
                      onPress={() => start(entry.plannedWorkoutId, entry.id)}
                    />
                  )}
                </Card>
              ))}
            </>
          )}
        </View>
        )}

        {/* Où tu vas. Une ligne qui défile : les objectifs se consultent d'un
            coup d'oeil, ils ne se lisent pas un par un depuis l'accueil. */}
        <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
                Objectifs
              </Text>
              {goals.length > 0 && (
                <Pressable onPress={() => router.push('/goals')} hitSlop={8}>
                  <Text className="text-small text-primary-ink dark:text-primary-ink-dark">
                    tout voir
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Toujours affichée, même vide : cachée, elle ne dit pas qu'un
                objectif existe et personne ne va le chercher. */}
            {goals.length === 0 ? (
              <Card density="titled" className="gap-2">
                <Text className="text-small text-muted dark:text-muted-dark">
                  Aucun objectif. Un objectif suit une progression : chaque étape est ce qu il
                  faut atteindre pour passer à la suivante.
                </Text>
                <Button
                  label="Créer un objectif"
                  variant="secondary"
                  size="md"
                  onPress={() => router.push('/new-goal')}
                />
              </Card>
            ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              horizontal
              showsHorizontalScrollIndicator={false}
              // Une hauteur commune, pas un étirement : la rangée vit dans
              // une page qui défile, et s'étirer sur elle allongeait les
              // vignettes bien au-delà de ce qu'elles contiennent.
              className="grow-0"
              contentContainerClassName="gap-2 pb-1 pr-4"
            >
              {goals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  evaluation={evaluations.get(goal.id)}
                  subjectName={(entry) => subjectName(entry.currentSubject)}
                  unitOf={unitOf}
                  width={190}
                  onPress={() => router.push({ pathname: '/goal', params: { id: goal.id } })}
                />
              ))}
            </ScrollView>
            )}
        </View>
      </ScrollView>

      <Sheet
        visible={planning === 'workout'}
        title="Planifier une séance"
        description="Lequel de tes entraînements, et pour quel jour."
        searchPlaceholder="Chercher un entraînement"
        actions={plans
          .filter((plan) => !plan.isArchived)
          .map((plan) => ({
            label: plan.name,
            onPress: () => {
              setChosen(plan);
              setPlanning('date');
            },
          }))}
        onClose={() => setPlanning('none')}
      />

      <DatePickerSheet
        visible={planning === 'date'}
        title={chosen ? `Programmer ${chosen.name}` : 'Programmer'}
        confirmLabel="Programmer"
        initial={day ?? new Date()}
        onConfirm={planFor}
        onClose={() => {
          setPlanning('none');
          setChosen(null);
        }}
      />
    </SafeAreaView>
  );
}
