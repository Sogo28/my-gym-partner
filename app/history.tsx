import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Exercise } from '../src/domain/exercise/exercise';
import type { Measurement } from '../src/domain/exercise/measurement';
import type { ExercisePerformance } from '../src/domain/performance/exercise-performance';
import type { PlannedWorkout } from '../src/domain/planned-workout/planned-workout';
import {
  restBeforeEachSet,
  sessionDuration,
  totalRest,
} from '../src/domain/workout-session/session-metrics';
import type { WorkoutSession } from '../src/domain/workout-session/workout-session';
import { findAll as findAllExercises, findAllMeasurements } from '../src/infra/exercise-repository';
import { findByIds } from '../src/infra/performance-repository';
import { findAll as findAllPlans } from '../src/infra/planned-workout-repository';
import { findAll as findAllSessions } from '../src/infra/workout-session-repository';

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'en cours',
  COMPLETED: 'terminée',
  CANCELLED: 'annulée',
};

/** 135 -> "2:15", 840 -> "14 min". Le formatage est de l'affichage, pas du domaine. */
function formatDuration(seconds: number): string {
  if (seconds >= 600) return `${Math.round(seconds / 60)} min`;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function HistoryScreen() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [performances, setPerformances] = useState<Map<string, ExercisePerformance>>(new Map());
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [plans, setPlans] = useState<PlannedWorkout[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [allSessions, allExercises, allMeasurements, allPlans] = await Promise.all([
          findAllSessions(),
          findAllExercises(),
          findAllMeasurements(),
          findAllPlans(),
        ]);

        // Tous les identifiants de performance d'un coup, plutôt qu'une
        // requête par activité.
        const ids = allSessions
          .flatMap((session) => session.activities)
          .map((activity) => activity.performanceId)
          .filter((id): id is string => id !== null);

        setSessions(allSessions);
        setExercises(allExercises);
        setMeasurements(allMeasurements);
        setPlans(allPlans);
        setPerformances(await findByIds(ids));
      })().catch((e) => setError(String(e)));
    }, []),
  );

  const nameOf = (exerciseId: string) =>
    exercises.find((e) => e.id === exerciseId)?.name ?? exerciseId;
  const unitOf = (measurementId: string) =>
    measurements.find((m) => m.id === measurementId)?.unit ?? measurementId;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <Text style={styles.screenTitle}>Historique</Text>
      <ScrollView contentContainerStyle={styles.content}>
      {error && <Text style={styles.error}>{error}</Text>}
      {sessions.length === 0 && <Text style={styles.muted}>Aucune séance enregistrée.</Text>}

      {sessions.map((session) => {
        const plan = plans.find((p) => p.id === session.plannedWorkoutId);
        const date = session.startedAt;
        const duration = sessionDuration(session);
        const rest = totalRest(session);

        return (
          <View key={session.id} style={styles.card}>
            <Text style={styles.cardTitle}>{plan ? plan.name : 'Séance libre'}</Text>
            <Text style={styles.muted}>
              {date.toLocaleDateString('fr-FR')} · {date.getHours()}h
              {String(date.getMinutes()).padStart(2, '0')} ·{' '}
              {STATUS_LABEL[session.status] ?? session.status}
            </Text>
            {duration !== null && (
              <Text style={styles.muted}>
                {formatDuration(duration)}
                {rest > 0 ? ` · dont ${formatDuration(rest)} de repos` : ''}
              </Text>
            )}

            {session.activities.map((activity, index) => {
              const performance = activity.performanceId
                ? performances.get(activity.performanceId)
                : undefined;
              // Seules les séries COMPLETED comptent comme performance (n°18).
              const done = performance?.completedSets ?? [];
              // Repos et séries n'ont aucun lien direct : on les rapproche
              // par les instants (voir session-metrics).
              const restsBefore = restBeforeEachSet(done, session.rests);

              return (
                <View key={index} style={styles.activity}>
                  <Text style={styles.activityTitle}>{nameOf(activity.exerciseId)}</Text>
                  {done.length === 0 ? (
                    <Text style={styles.muted}>aucune série complétée</Text>
                  ) : (
                    done.map((set, setIndex) => (
                      <View key={setIndex}>
                        {/* Le repos s'intercale entre les deux séries qu'il sépare :
                            sa place à l'écran suit la chronologie réelle. */}
                        {restsBefore[setIndex] ? (
                          <Text style={styles.restLine}>
                            repos {formatDuration(restsBefore[setIndex]!)}
                          </Text>
                        ) : null}
                        <Text style={styles.setLine}>
                          Série {setIndex + 1} ·{' '}
                          {Object.entries(set.values)
                            .map(([id, value]) => `${value} ${unitOf(id)}`)
                            .join(' · ')}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              );
            })}
          </View>
        );
      })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  screenTitle: { fontSize: 26, fontWeight: '800', paddingHorizontal: 20, paddingTop: 16 },
  content: { padding: 20, gap: 14, paddingBottom: 60 },
  card: { borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 10, padding: 14, gap: 6 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  muted: { color: '#71717a' },
  activity: { marginTop: 8, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: '#e4e4e7' },
  activityTitle: { fontWeight: '600' },
  setLine: { color: '#3f3f46' },
  restLine: { color: '#a1a1aa', fontSize: 13, paddingVertical: 2 },
  error: { color: '#dc2626' },
});
