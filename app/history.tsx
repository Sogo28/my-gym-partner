import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Exercise } from '../src/domain/exercise/exercise';
import type { Measurement } from '../src/domain/exercise/measurement';
import type { ExercisePerformance } from '../src/domain/performance/exercise-performance';
import type { PlannedWorkout } from '../src/domain/planned-workout/planned-workout';
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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {error && <Text style={styles.error}>{error}</Text>}
      {sessions.length === 0 && <Text style={styles.muted}>Aucune séance enregistrée.</Text>}

      {sessions.map((session) => {
        const plan = plans.find((p) => p.id === session.plannedWorkoutId);
        const date = session.startedAt;

        return (
          <View key={session.id} style={styles.card}>
            <Text style={styles.cardTitle}>{plan ? plan.name : 'Séance libre'}</Text>
            <Text style={styles.muted}>
              {date.toLocaleDateString('fr-FR')} · {date.getHours()}h
              {String(date.getMinutes()).padStart(2, '0')} ·{' '}
              {STATUS_LABEL[session.status] ?? session.status}
            </Text>

            {session.activities.map((activity, index) => {
              const performance = activity.performanceId
                ? performances.get(activity.performanceId)
                : undefined;
              // Seules les séries COMPLETED comptent comme performance (n°18).
              const done = performance?.completedSets ?? [];

              return (
                <View key={index} style={styles.activity}>
                  <Text style={styles.activityTitle}>{nameOf(activity.exerciseId)}</Text>
                  {done.length === 0 ? (
                    <Text style={styles.muted}>aucune série complétée</Text>
                  ) : (
                    done.map((set, setIndex) => (
                      <Text key={setIndex} style={styles.setLine}>
                        Série {setIndex + 1} ·{' '}
                        {Object.entries(set.values)
                          .map(([id, value]) => `${value} ${unitOf(id)}`)
                          .join(' · ')}
                      </Text>
                    ))
                  )}
                </View>
              );
            })}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, gap: 14, paddingBottom: 60 },
  card: { borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 10, padding: 14, gap: 6 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  muted: { color: '#71717a' },
  activity: { marginTop: 8, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: '#e4e4e7' },
  activityTitle: { fontWeight: '600' },
  setLine: { color: '#3f3f46' },
  error: { color: '#dc2626' },
});
