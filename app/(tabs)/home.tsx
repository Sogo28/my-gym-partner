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
import { formatDateTime } from '../../src/ui/format';
import { messageOf } from '../../src/ui/message';
import { BusinessNotice } from '../../src/ui/notice';
import { SectionHeader } from '../../src/ui/screen-header';
import { evaluateGoal, listGoals, type GoalEvaluation } from '../../src/use-cases/goal-actions';
import { listMetrics } from '../../src/use-cases/body-actions';
import { findAllMeasurements } from '../../src/infra/exercise-repository';
import { describeSource } from '../../src/ui/goal-labels';
import { StepGauge } from '../../src/ui/step-gauge';
import type { Measurement } from '../../src/domain/exercise/measurement';
import type { BodyMetric } from '../../src/domain/body/body-metric';
import { listSchedule, scheduleWorkout } from '../../src/use-cases/scheduling-actions';
import { startWorkoutSession } from '../../src/use-cases/workout-session-actions';
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
  /** L'étape de la planification : choisir l'entraînement, puis sa date. */
  const [planning, setPlanning] = useState<'none' | 'workout' | 'date'>('none');
  const [chosen, setChosen] = useState<PlannedWorkout | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      ])
        .then(([active, summary, allSchedule, allPlans, allGoals, days, allMeasurements, allMetrics]) => {
          setSession(active);
          setWeek(summary);
          setDone(days);
          setSchedule(allSchedule.filter((entry) => entry.status === 'SCHEDULED'));
          setPlans(allPlans);
          setMeasurements(allMeasurements);
          setMetrics(allMetrics);

          const running = allGoals.filter((goal) => goal.status === 'ACTIVE');
          setGoals(running);
          return Promise.all(running.map((goal) => evaluateGoal(goal))).then((results) => {
            setEvaluations(new Map(running.map((goal, index) => [goal.id, results[index]])));
          });
        })
        .catch((e) => setError(messageOf(e)));
    }, []),
  );

  const planNameOf = (id: string) => plans.find((plan) => plan.id === id)?.name ?? id;

  /**
   * L'unité de ce qui est évalué : celle d'une mesure de performance, ou
   * celle d'une mensuration -- une condition sur un tour de cuisse s'exprime
   * en centimètres.
   */
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
  const plannedToday = thisWeek.filter(
    (entry) => startOfDay(entry.scheduledAt).getTime() === today.getTime(),
  );
  const strip = weekDays(new Date()).map((date) => ({
    date,
    worked: done.some((entry) => entry.getTime() === date.getTime()),
    scheduled: thisWeek.some(
      (entry) => startOfDay(entry.scheduledAt).getTime() === date.getTime(),
    ),
    today: date.getTime() === today.getTime(),
  }));

  /** Démarrer la séance prévue : elle est marquée exécutée en se terminant. */
  async function start(plannedWorkoutId: string, scheduledId: string) {
    try {
      await startWorkoutSession(plannedWorkoutId, scheduledId);
      router.push('/session');
    } catch (e) {
      setError(messageOf(e));
    }
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

      <ScrollView contentContainerClassName="gap-5 px-5 pb-8">
        {error && <BusinessNotice message={error} />}

        {/* Une séance ouverte passe avant tout le reste : sans ce bandeau,
            elle serait injoignable depuis ici. */}
        {session && (
          <Card density="accent" className="gap-2">
            <Text className="font-bold uppercase text-label text-primary-ink dark:text-primary-ink-dark">
              Séance en cours
            </Text>
            <Text className="font-mono text-[12px] text-muted dark:text-muted-dark">
              commencée à {formatDateTime(session.startedAt)}
            </Text>
            <Button label="Reprendre" size="md" onPress={() => router.push('/session')} />
          </Card>
        )}

        {/* Ce qui a été fait -- la semaine, ou le jour qu'on a choisi. */}
        <View className="gap-3">
          <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
            {day
              ? `Travaillé le ${day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })}`
              : 'Travaillé cette semaine'}
          </Text>

          {/* Le schéma reste, même vide : une silhouette sans couleur dit
              « rien ce jour-là » sans faire sauter la page, et garde le
              calendrier à la même place d'un jour à l'autre. */}
          <BodyMap parts={worked} scale={0.62} />

          <WeekStrip days={strip} selected={day} onSelect={select} />

          {/* Sous le calendrier : on regarde d'abord ce qui a été fait, on
              décide ensuite. Une séance en cours, elle, garde sa place en
              haut -- c'est une interruption, pas une décision à prendre. */}
          {!session && (
            <Button
              label="Démarrer une séance"
              size="lg"
              className="mt-1"
              onPress={() => router.push('/session')}
            />
          )}
        </View>

        {/* Ce qui est prévu AUJOURD'HUI, et rien de plus : le reste de la
            semaine se lit déjà dans les carrés du calendrier. */}
        <View className="gap-2">
          <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
            Aujourd hui
          </Text>

          {plannedToday.length === 0 ? (
            <Card density="titled" className="gap-2">
              <Text className="text-[13px] text-muted dark:text-muted-dark">
                Aucune séance prévue aujourd hui.
              </Text>
              <Button
                label="Planifier une séance"
                variant="secondary"
                size="md"
                onPress={() => setPlanning('workout')}
              />
            </Card>
          ) : (
            plannedToday.map((entry) => (
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
                <Button
                  label="Démarrer"
                  size="md"
                  onPress={() => start(entry.plannedWorkoutId, entry.id)}
                />
              </Card>
            ))
          )}
        </View>

        {/* Où tu vas. Une ligne qui défile : les objectifs se consultent d'un
            coup d'oeil, ils ne se lisent pas un par un depuis l'accueil. */}
        {goals.length > 0 && (
          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
                Objectifs
              </Text>
              <Pressable onPress={() => router.push('/goals')} hitSlop={8}>
                <Text className="text-[13px] text-primary-ink dark:text-primary-ink-dark">
                  tout voir
                </Text>
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2 pr-4"
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
                      <Text
                        className="font-bold text-[15px] text-ink dark:text-ink-dark"
                        numberOfLines={2}
                      >
                        {goal.name}
                      </Text>

                      {goal.isProgressive && (
                        <StepGauge
                          total={goal.steps.length}
                          done={goal.currentStepIndex}
                          currentSatisfied={evaluation?.satisfied ?? false}
                        />
                      )}

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
                            {/* La valeur au-dessus est celle de l'étape en
                                cours : sans le dire, elle a l'air de flotter
                                à côté des carrés. */}
                            {results.length > 1
                              ? `${met} condition${met > 1 ? 's' : ''} sur ${results.length}`
                              : goal.isProgressive
                                ? `étape ${goal.currentStepIndex + 1} sur ${goal.steps.length}`
                                : describeSource(first.condition)}
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
          </View>
        )}
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
