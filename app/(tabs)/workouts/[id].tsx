import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { messageOf } from '../../../src/ui/message';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Exercise } from '../../../src/domain/exercise/exercise';
import type { Measurement } from '../../../src/domain/exercise/measurement';
import type { PlannedWorkout } from '../../../src/domain/planned-workout/planned-workout';
import { findAll as findAllExercises, findAllMeasurements } from '../../../src/infra/exercise-repository';
import { findAll as findAllPlans } from '../../../src/infra/planned-workout-repository';
import { Button } from '../../../src/ui/button';
import { Collapsible } from '../../../src/ui/collapsible';
import { DatePickerSheet } from '../../../src/ui/date-picker';
import { formatDateTime } from '../../../src/ui/format';
import { BackHeader } from '../../../src/ui/screen-header';
import { discardWorkout, unarchiveWorkout } from '../../../src/use-cases/edit-catalogue';
import { scheduleWorkout } from '../../../src/use-cases/scheduling-actions';
import { startWorkoutSession } from '../../../src/use-cases/workout-session-actions';

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
  const [picking, setPicking] = useState(false);
  const [scheduled, setScheduled] = useState<Date | null>(null);

  // À chaque affichage : revenir de l'écran d'édition doit montrer
  // l'entraînement modifié, pas celui d'avant.
  useFocusEffect(
    useCallback(() => {
      Promise.all([findAllPlans(), findAllExercises(), findAllMeasurements()])
        .then(([plans, allExercises, allMeasurements]) => {
          setPlan(plans.find((candidate) => candidate.id === id) ?? null);
          setExercises(allExercises);
          setMeasurements(allMeasurements);
        })
        .catch((e) => setError(messageOf(e)));
    }, [id]),
  );

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
      setError(messageOf(e));
    }
  }

  if (!plan) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background p-5 dark:bg-background-dark">
        <BackHeader title="Entraînement" onBack={() => router.back()} />
        <Text className="text-muted dark:text-muted-dark">
          {error ?? 'Entraînement introuvable.'}
        </Text>
      </SafeAreaView>
    );
  }

  const totalSets = plan.exercises.reduce((total, e) => total + e.sets.length, 0);

  /** ScheduleWorkout : placer cet entraînement à une date, sans le démarrer. */
  async function schedule(at: Date) {
    setPicking(false);
    try {
      await scheduleWorkout({ plannedWorkoutId: id, at });
      setScheduled(at);
      setError(null);
    } catch (e) {
      setError(messageOf(e));
    }
  }

  /** Archivé s'il a déjà produit des séances, supprimé sinon. */
  async function discard() {
    if (!plan) return;
    try {
      await discardWorkout(plan);
      router.back();
    } catch (e) {
      setError(messageOf(e));
    }
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-5 pt-4">
        <BackHeader
          title={plan.name}
          subtitle={`${plan.exercises.length} exercice${plan.exercises.length > 1 ? 's' : ''} · ${totalSets} série${totalSets > 1 ? 's' : ''} prévue${totalSets > 1 ? 's' : ''}`}
          onBack={() => router.back()}
        />
      </View>
      <ScrollView contentContainerClassName="gap-3 p-5 pb-8">

        {plan.exercises.map((planned, position) => (
          <Collapsible
            key={`${planned.exerciseId}-${position}`}
            title={`${position + 1}. ${nameOf(planned.exerciseId)}`}
            summary={`${planned.sets.length} série${planned.sets.length > 1 ? 's' : ''}`}
          >
            {planned.sets.length === 0 ? (
              <Text className="text-muted dark:text-muted-dark">aucune série prévue</Text>
            ) : (
              planned.sets.map((set, index) => (
                <Text key={index} className="font-mono text-[15px] text-planned">
                  Série {index + 1} ·{' '}
                  {Object.entries(set.targets)
                    .map(([measurementId, value]) => `${value} ${unitOf(measurementId)}`)
                    .join(' · ')}
                </Text>
              ))
            )}
          </Collapsible>
        ))}

        {error && <Text className="text-danger dark:text-danger-dark">{error}</Text>}
      </ScrollView>

      {/* Action principale ancrée en bas, hors du défilement. */}
      <View className="gap-2 p-5 pt-2">
        {scheduled && (
          <Text className="text-center font-mono text-[12px] text-success dark:text-success-dark">
            programmé le {formatDateTime(scheduled)}
          </Text>
        )}
        <Button label="Démarrer la séance" size="xl" onPress={start} />
        <View className="flex-row gap-2">
          <Button
            label="Programmer"
            variant="secondary"
            size="md"
            className="flex-1"
            onPress={() => setPicking(true)}
          />
          <Button
            label="Modifier"
            variant="secondary"
            size="md"
            className="flex-1"
            onPress={() => router.push({ pathname: '/workouts/new', params: { id } })}
          />
        </View>
        {plan.isArchived ? (
          <Button
            label="Remettre au catalogue"
            variant="secondary"
            size="md"
            onPress={() =>
              unarchiveWorkout(plan)
                .then(() => router.back())
                .catch((e) => setError(messageOf(e)))
            }
          />
        ) : (
          <Button
            label="Retirer cet entraînement"
            variant="danger"
            size="md"
            onPress={discard}
          />
        )}
      </View>

      <DatePickerSheet
        visible={picking}
        title="Programmer cet entraînement"
        confirmLabel="Programmer"
        onConfirm={schedule}
        onClose={() => setPicking(false)}
      />
    </SafeAreaView>
  );
}
