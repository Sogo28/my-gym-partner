import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Exercise } from '../../src/domain/exercise/exercise';
import type { Measurement } from '../../src/domain/exercise/measurement';
import type { PlannedWorkout } from '../../src/domain/planned-workout/planned-workout';
import { findAll as findAllExercises, findAllMeasurements } from '../../src/infra/exercise-repository';
import { findAll as findAllPlans } from '../../src/infra/planned-workout-repository';
import { startWorkoutSession } from '../../src/use-cases/workout-session-actions';

/**
 * Aperçu d'un entraînement. Le nom du fichier entre crochets en fait une route
 * DYNAMIQUE : /workouts/abc-123 ouvre cet écran avec id = "abc-123".
 *
 * Écran volontairement sans effet de bord : consulter un entraînement ne le
 * démarre pas. La séance ne commence qu'au tap explicite.
 */
export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<PlannedWorkout | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([findAllPlans(), findAllExercises(), findAllMeasurements()])
      .then(([plans, allExercises, allMeasurements]) => {
        setPlan(plans.find((candidate) => candidate.id === id) ?? null);
        setExercises(allExercises);
        setMeasurements(allMeasurements);
      })
      .catch((e) => setError(String(e)));
  }, [id]);

  const nameOf = (exerciseId: string) =>
    exercises.find((e) => e.id === exerciseId)?.name ?? exerciseId;
  const unitOf = (measurementId: string) =>
    measurements.find((m) => m.id === measurementId)?.unit ?? measurementId;

  async function start() {
    try {
      await startWorkoutSession(id);
      // replace et non push : une fois la séance lancée, revenir en arrière
      // sur l'aperçu n'aurait pas de sens.
      router.replace('/session');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (!plan) {
    return (
      <View style={styles.screen}>
        <Text style={styles.muted}>{error ?? 'Entraînement introuvable.'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{plan.name}</Text>

      {plan.exercises.map((planned, position) => (
        <View key={`${planned.exerciseId}-${position}`} style={styles.card}>
          <Text style={styles.cardTitle}>
            {position + 1}. {nameOf(planned.exerciseId)}
          </Text>
          {planned.sets.length === 0 ? (
            <Text style={styles.muted}>aucune série prévue</Text>
          ) : (
            planned.sets.map((set, index) => (
              <Text key={index} style={styles.setLine}>
                Série {index + 1} ·{' '}
                {Object.entries(set.targets)
                  .map(([measurementId, value]) => `${value} ${unitOf(measurementId)}`)
                  .join(' · ')}
              </Text>
            ))
          )}
        </View>
      ))}

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={start}>
        <Text style={styles.buttonText}>Démarrer la séance</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, gap: 12, paddingBottom: 60 },
  title: { fontSize: 24, fontWeight: '700' },
  card: { borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 10, padding: 14, gap: 4 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  setLine: { color: '#3f3f46' },
  muted: { color: '#71717a', padding: 20 },
  error: { color: '#dc2626' },
  button: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});
