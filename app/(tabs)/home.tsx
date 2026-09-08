import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Goal } from '../../src/domain/goal/goal';
import type { PlannedWorkout } from '../../src/domain/planned-workout/planned-workout';
import type { ScheduledWorkout } from '../../src/domain/scheduling/scheduled-workout';
import type { WorkoutSession } from '../../src/domain/workout-session/workout-session';
import { findAll as findAllPlans } from '../../src/infra/planned-workout-repository';
import { findActive } from '../../src/infra/workout-session-repository';
import { BodyMap } from '../../src/ui/body-map';
import { highlight } from '../../src/ui/body-slugs';
import { Button } from '../../src/ui/button';
import { Card } from '../../src/ui/card';
import { dayLabel, formatDateTime } from '../../src/ui/format';
import { messageOf } from '../../src/ui/message';
import { BusinessNotice } from '../../src/ui/notice';
import { SectionHeader } from '../../src/ui/screen-header';
import { evaluateGoal, listGoals, type GoalEvaluation } from '../../src/use-cases/goal-actions';
import { listMetrics } from '../../src/use-cases/body-actions';
import {
  findAll as findAllExercises,
  findAllMeasurements,
} from '../../src/infra/exercise-repository';
import type { Exercise } from '../../src/domain/exercise/exercise';
import type { GoalSubject } from '../../src/domain/goal/goal';
import { describeSourceShort } from '../../src/ui/goal-labels';
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
  const router = useRouter();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [week, setWeek] = useState<MuscleSummary>(EMPTY);
  const [done, setDone] = useState<Date[]>([]);
  /** Le jour regardé seul, ou null pour la semaine entière. */
  const [day, setDay] = useState<Date | null>(null);
  const [dayWork, setDayWork] = useState<MuscleSummary>(EMPTY);
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
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      // Une erreur appartient au moment où elle s'est produite : la garder
      // d'un affichage à l'autre ferait porter à l'écran une panne qui n'a
      // plus lieu -- et l'écran, lui, reste monté quand on le quitte.
      setError(null);

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
        .catch((e) => setError(messageOf(e)));
    }, []),
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
      .catch((e) => setError(messageOf(e)));
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
  const plannedThatDay = thisWeek.filter(
    (entry) => startOfDay(entry.scheduledAt).getTime() === shownDay.getTime(),
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
      setError(null);
    } catch (e) {
      setError(messageOf(e));
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

      <ScrollView contentContainerClassName="gap-5 px-5 pb-10">
        {error && <BusinessNotice message={error} />}

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
              <Text className="font-mono text-[12px] text-muted dark:text-muted-dark">
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

          {plannedThatDay.length === 0 ? (
            <Card density="titled" className="gap-2">
              <Text className="text-[13px] text-muted dark:text-muted-dark">
                {schedulable.length === 0
                  ? "Aucun entraînement à programmer pour l'instant. Un entraînement regroupe des exercices et leurs séries cibles."
                  : `Aucune séance prévue ${dayLabel(shownDay, new Date())}.`}
              </Text>
              {/* Sans entraînement, « Planifier » n'ouvrirait qu'une liste
                  vide : l'invitation mène là où il y a quelque chose à faire. */}
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
            </Card>
          ) : (
            plannedThatDay.map((entry) => (
              <Card key={entry.id} density="titled" className="gap-2">
                <View className="flex-row items-start justify-between gap-3">
                  <Text
                    className="shrink font-extrabold text-[17px] text-ink dark:text-ink-dark"
                    numberOfLines={1}
                  >
                    {planNameOf(entry.plannedWorkoutId)}
                  </Text>
                  <Text className="font-mono text-[12px] text-muted dark:text-muted-dark">
                    {formatDateTime(entry.scheduledAt)}
                  </Text>
                </View>

                {/* Faite : on ne repropose pas de la démarrer. Le dire vaut
                    mieux que la faire disparaître -- un vide ressemblerait à
                    un oubli de programmation. */}
                {entry.status === 'EXECUTED' ? (
                  <Text className="text-[13px] text-success dark:text-success-dark">
                    Séance faite.
                  </Text>
                ) : (
                  <Button
                    label="Démarrer"
                    size="md"
                    onPress={() => start(entry.plannedWorkoutId, entry.id)}
                  />
                )}
              </Card>
            ))
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
                  <Text className="text-[13px] text-primary-ink dark:text-primary-ink-dark">
                    tout voir
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Toujours affichée, même vide : cachée, elle ne dit pas qu'un
                objectif existe et personne ne va le chercher. */}
            {goals.length === 0 ? (
              <Card density="titled" className="gap-2">
                <Text className="text-[13px] text-muted dark:text-muted-dark">
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
              horizontal
              showsHorizontalScrollIndicator={false}
              // Une hauteur commune, pas un étirement : la rangée vit dans
              // une page qui défile, et s'étirer sur elle allongeait les
              // vignettes bien au-delà de ce qu'elles contiennent.
              className="grow-0"
              contentContainerClassName="gap-2 pb-1 pr-4"
            >
              {goals.map((goal) => {
                const evaluation = evaluations.get(goal.id);
                const results = evaluation?.results ?? [];
                // La première condition suffit à situer l'objectif ; le compte
                // dit qu'il y en a d'autres, sans les empiler sur une vignette.
                const first = results[0];
                const met = results.filter((result) => result.satisfied).length;

                return (
                  <Pressable key={goal.id} onPress={() => router.push('/goals')}>
                    <Card className="w-[190px] gap-2">
                      {/* Deux lignes RÉSERVÉES, occupées ou non : c'est ce qui
                          aligne les vignettes entre elles sans les étirer, un
                          nom court ne devant pas raccourcir sa carte. */}
                      <Text
                        className="h-[38px] font-bold text-[15px] leading-[19px] text-ink dark:text-ink-dark"
                        numberOfLines={2}
                      >
                        {goal.name}
                      </Text>

                      {/* Ce qui est visé, nommé -- l'étape en cours pour une
                          progression, le sujet pour un objectif simple. Le
                          numéro d'étape ne dirait pas quelle variante on
                          travaille, et c'est elle qu'on cherche ici. */}
                      <Text
                        className="text-[12px] text-primary-ink dark:text-primary-ink-dark"
                        numberOfLines={1}
                      >
                        {subjectName(goal.currentSubject)}
                      </Text>

                      {first ? (
                        <View className="gap-0.5">
                          <Text
                            className="font-mono-bold text-[15px] text-ink dark:text-ink-dark"
                            style={{ fontVariant: ['tabular-nums'] }}
                          >
                            {first.actual === null
                              ? '—'
                              : `${Math.round(first.actual * 10) / 10}`}
                            <Text className="font-sans text-[12px] text-muted dark:text-muted-dark">
                              {' / '}
                              {first.condition.target} {unitOf(first.condition.measurementId)}
                            </Text>
                          </Text>
                          <Text
                            className="text-[10px] text-muted dark:text-muted-dark"
                            numberOfLines={1}
                          >
                            {results.length > 1
                              ? `${met} condition${met > 1 ? 's' : ''} sur ${results.length}`
                              : describeSourceShort(first.condition)}
                          </Text>
                        </View>
                      ) : (
                        <Text className="text-[11px] text-muted dark:text-muted-dark">
                          {goal.isProgressive
                            ? `étape ${goal.currentStepIndex + 1}/${goal.steps.length}`
                            : 'à valider à la main'}
                        </Text>
                      )}
                    </Card>
                  </Pressable>
                );
              })}
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
