import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { Exercise } from '../../src/domain/exercise/exercise';
import type { Measurement } from '../../src/domain/exercise/measurement';
import type { PlannedWorkout } from '../../src/domain/planned-workout/planned-workout';
import { findAll as findAllExercises, findAllMeasurements } from '../../src/infra/exercise-repository';
import { findAll as findAllPlans } from '../../src/infra/planned-workout-repository';
import { Button } from '../../src/ui/button';
import { Collapsible } from '../../src/ui/collapsible';
import { startWorkoutSession } from '../../src/use-cases/workout-session-actions';

/**
 * Aperçu d'un entraînement. Le nom du fichier entre crochets en fait une route
 * DYNAMIQUE : /workouts/abc-123 ouvre cet écran avec id = "abc-123".
 *
 * Écran sans effet de bord : consulter un entraînement ne le démarre pas.
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
      // replace et non push : une fois la séance lancée, revenir sur l'aperçu
      // n'aurait pas de sens.
      router.replace('/session');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (!plan) {
    return (
      <View className="flex-1 bg-white p-5">
        <Text className="text-muted-foreground">{error ?? 'Entraînement introuvable.'}</Text>
      </View>
    );
  }

  const totalSets = plan.exercises.reduce((total, e) => total + e.sets.length, 0);

  return (
    <View className="flex-1 bg-white">
      <ScrollView contentContainerClassName="gap-3 p-5 pb-8">
        <View>
          <Text className="text-2xl font-extrabold">{plan.name}</Text>
          <Text className="text-muted-foreground">
            {plan.exercises.length} exercice{plan.exercises.length > 1 ? 's' : ''} · {totalSets}{' '}
            série{totalSets > 1 ? 's' : ''}
          </Text>
        </View>

        {plan.exercises.map((planned, position) => (
          <Collapsible
            key={`${planned.exerciseId}-${position}`}
            title={`${position + 1}. ${nameOf(planned.exerciseId)}`}
            summary={`${planned.sets.length} série${planned.sets.length > 1 ? 's' : ''}`}
          >
            {planned.sets.length === 0 ? (
              <Text className="text-muted-foreground">aucune série prévue</Text>
            ) : (
              planned.sets.map((set, index) => (
                <Text key={index} className="text-zinc-700">
                  Série {index + 1} ·{' '}
                  {Object.entries(set.targets)
                    .map(([measurementId, value]) => `${value} ${unitOf(measurementId)}`)
                    .join(' · ')}
                </Text>
              ))
            )}
          </Collapsible>
        ))}

        {error && <Text className="text-destructive">{error}</Text>}
      </ScrollView>

      {/* Action principale ancrée en bas, hors du défilement. */}
      <View className="border-t border-border bg-white p-5">
        <Button label="Démarrer la séance" size="lg" onPress={start} />
      </View>
    </View>
  );
}
