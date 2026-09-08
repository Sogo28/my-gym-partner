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
import { listGoals } from '../../src/use-cases/goal-actions';
import { listSchedule } from '../../src/use-cases/scheduling-actions';
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
      ])
        .then(([active, summary, allSchedule, allPlans, allGoals, days]) => {
          setSession(active);
          setWeek(summary);
          setDone(days);
          setSchedule(allSchedule.filter((entry) => entry.status === 'SCHEDULED'));
          setPlans(allPlans);
          setGoals(allGoals.filter((goal) => goal.status === 'ACTIVE'));
        })
        .catch((e) => setError(messageOf(e)));
    }, []),
  );

  const planNameOf = (id: string) => plans.find((plan) => plan.id === id)?.name ?? id;

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
  const strip = weekDays(new Date()).map((date) => ({
    date,
    worked: done.some((entry) => entry.getTime() === date.getTime()),
    scheduled: thisWeek.some(
      (entry) => startOfDay(entry.scheduledAt).getTime() === date.getTime(),
    ),
    today: date.getTime() === today.getTime(),
  }));

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

        {/* Ce que tu fais maintenant. Une séance ouverte passe avant tout le
            reste : sans ce bandeau, elle serait injoignable depuis ici. */}
        {session ? (
          <Card density="accent" className="gap-2">
            <Text className="font-bold uppercase text-label text-primary-ink dark:text-primary-ink-dark">
              Séance en cours
            </Text>
            <Text className="font-mono text-[12px] text-muted dark:text-muted-dark">
              commencée à {formatDateTime(session.startedAt)}
            </Text>
            <Button label="Reprendre" size="md" onPress={() => router.push('/session')} />
          </Card>
        ) : (
          <Button label="Démarrer une séance" size="lg" onPress={() => router.push('/session')} />
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
        </View>

        {/* Ce qui vient. */}
        {thisWeek.length > 0 && (
          <View className="gap-2">
            <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
              Prévu cette semaine
            </Text>
            {thisWeek.map((entry) => (
              <Card key={entry.id} className="flex-row items-center justify-between gap-3">
                <Text
                  className="shrink font-bold text-[15px] text-ink dark:text-ink-dark"
                  numberOfLines={1}
                >
                  {planNameOf(entry.plannedWorkoutId)}
                </Text>
                <Text className="font-mono text-[12px] text-muted dark:text-muted-dark">
                  {formatDateTime(entry.scheduledAt)}
                </Text>
              </Card>
            ))}
          </View>
        )}

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
              {goals.map((goal) => (
                <Pressable key={goal.id} onPress={() => router.push('/goals')}>
                  <Card className="w-[180px] gap-1">
                    <Text
                      className="font-bold text-[15px] text-ink dark:text-ink-dark"
                      numberOfLines={2}
                    >
                      {goal.name}
                    </Text>
                    <Text className="font-mono text-[11px] text-muted dark:text-muted-dark">
                      {goal.isProgressive
                        ? `étape ${goal.currentStepIndex + 1}/${goal.steps.length}`
                        : 'objectif simple'}
                    </Text>
                  </Card>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
