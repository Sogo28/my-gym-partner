import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Exercise } from '../src/domain/exercise/exercise';
import type { Measurement } from '../src/domain/exercise/measurement';
import type { ExercisePerformance } from '../src/domain/performance/exercise-performance';
import type { PlannedWorkout } from '../src/domain/planned-workout/planned-workout';
import type { WorkoutSession } from '../src/domain/workout-session/workout-session';
import { findAll as findAllExercises, findAllMeasurements } from '../src/infra/exercise-repository';
import { findById as findPerformanceById } from '../src/infra/performance-repository';
import { findAll as findAllPlans } from '../src/infra/planned-workout-repository';
import { findActive } from '../src/infra/workout-session-repository';
import {
  cancelWorkoutSession,
  correctSet,
  finishWorkoutSession,
  goToNextExercise,
  startActivity,
  startPerformanceSet,
  completePerformanceSet,
  startWorkoutSession,
  stopRest,
} from '../src/use-cases/workout-session-actions';

export default function SessionScreen() {
  const router = useRouter();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [performance, setPerformance] = useState<ExercisePerformance | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [plans, setPlans] = useState<PlannedWorkout[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [showFreeExercises, setShowFreeExercises] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [active, allExercises, allPlans, allMeasurements] = await Promise.all([
      findActive(),
      findAllExercises(),
      findAllPlans(),
      findAllMeasurements(),
    ]);
    setSession(active);
    setExercises(allExercises);
    setPlans(allPlans);
    setMeasurements(allMeasurements);

    const performanceId = active?.currentActivity?.performanceId ?? null;
    setPerformance(performanceId ? await findPerformanceById(performanceId) : null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload().catch((e) => setError(String(e)));
    }, [reload]),
  );

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
      await reload();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const nameOf = (exerciseId: string) =>
    exercises.find((e) => e.id === exerciseId)?.name ?? exerciseId;
  const unitOf = (measurementId: string) =>
    measurements.find((m) => m.id === measurementId)?.unit ?? measurementId;

  // --- Le chronomètre de repos : un rendu par seconde, uniquement pendant le repos.
  const restStartedAt = session?.currentRest?.startedAt.getTime() ?? null;
  const [, setTick] = useState(0);
  useEffect(() => {
    if (restStartedAt === null) return;
    const interval = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, [restStartedAt]);
  const restElapsed = restStartedAt === null ? 0 : Math.floor((Date.now() - restStartedAt) / 1000);

  if (!session) {
    return (
      <View style={styles.screen}>
        <Text style={styles.muted}>Aucune séance en cours.</Text>
        <Pressable style={styles.button} onPress={() => router.push('/workouts')}>
          <Text style={styles.buttonText}>Choisir un entraînement</Text>
        </Pressable>
        <Pressable style={styles.buttonOutline} onPress={() => run(() => startWorkoutSession())}>
          <Text style={styles.buttonOutlineText}>Séance libre</Text>
        </Pressable>
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    );
  }

  const plan = plans.find((p) => p.id === session.plannedWorkoutId);
  const activity = session.currentActivity;
  const plannedExercise =
    activity?.plannedPosition != null ? plan?.exercises[activity.plannedPosition] : undefined;

  const doneSets = performance?.sets ?? [];
  const nextSetIndex = doneSets.length;
  const plannedSet = plannedExercise?.sets[nextSetIndex];
  const lastSetIndex = nextSetIndex - 1;

  /** Démarrer une série pré-remplit les champs avec ce qui était prévu. */
  function beginSet() {
    run(async () => {
      await startPerformanceSet();
      const targets = plannedSet?.targets ?? {};
      setValues(
        Object.fromEntries(Object.entries(targets).map(([id, value]) => [id, String(value)])),
      );
    });
  }

  function parsedValues(): Record<string, number> {
    const parsed: Record<string, number> = {};
    for (const [measurementId, raw] of Object.entries(values)) {
      if (raw.trim() !== '') parsed[measurementId] = Number(raw.replace(',', '.'));
    }
    return parsed;
  }

  function confirmCancel() {
    Alert.alert('Annuler la séance ?', 'Les séries déjà validées seront conservées.', [
      { text: 'Continuer la séance', style: 'cancel' },
      { text: 'Annuler la séance', style: 'destructive', onPress: () => run(cancelWorkoutSession) },
    ]);
  }

  const position = activity?.plannedPosition;
  const totalExercises = plan?.exercises.length ?? 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.muted}>
        {plan ? plan.name : 'Séance libre'}
        {position != null && totalExercises > 0 ? ` · exercice ${position + 1}/${totalExercises}` : ''}
      </Text>

      {activity ? (
        <>
          <Text style={styles.exerciseTitle}>{nameOf(activity.exerciseId)}</Text>

          {/* Toutes les séries de l'exercice : faites, abandonnées, puis prévues. */}
          {doneSets.map((set, index) => (
            <Text key={index} style={set.status === 'COMPLETED' ? styles.setDone : styles.setOther}>
              {index + 1}.{' '}
              {set.status === 'IN_PROGRESS'
                ? 'en cours'
                : Object.entries(set.values)
                    .map(([id, value]) => `${value} ${unitOf(id)}`)
                    .join(' · ') || '—'}
              {set.status === 'ABANDONED' ? '  abandonnée' : ''}
            </Text>
          ))}
          {plannedExercise?.sets.slice(nextSetIndex).map((set, index) => (
            <Text key={`planned-${index}`} style={styles.setPlanned}>
              {nextSetIndex + index + 1}.{' '}
              {Object.entries(set.targets)
                .map(([id, value]) => `${value} ${unitOf(id)}`)
                .join(' · ')}{' '}
              prévu
            </Text>
          ))}

          {/* Zone d'action : ce qu'il y a à faire maintenant, et rien d'autre. */}
          <View style={styles.actionBlock}>
            {session.currentRest && (
              <View style={styles.restRow}>
                <Text style={styles.restTimer}>
                  {Math.floor(restElapsed / 60)}:{String(restElapsed % 60).padStart(2, '0')}
                </Text>
                <Text style={styles.muted}>de repos</Text>
              </View>
            )}

            {(performance?.currentSet || session.currentRest) && (
              <View style={styles.inputRow}>
                {(performance?.measurementIds ?? []).map((measurementId) => (
                  <View key={measurementId} style={styles.field}>
                    <Text style={styles.fieldLabel}>{unitOf(measurementId)}</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={values[measurementId] ?? ''}
                      onChangeText={(text) =>
                        setValues((current) => ({ ...current, [measurementId]: text }))
                      }
                    />
                  </View>
                ))}
              </View>
            )}

            {performance?.currentSet ? (
              <Pressable
                style={styles.button}
                onPress={() => run(() => completePerformanceSet(parsedValues()))}
              >
                <Text style={styles.buttonText}>Terminer la série {nextSetIndex}</Text>
              </Pressable>
            ) : session.currentRest ? (
              <>
                {/* Pendant le repos : corriger ce qu'on vient de valider, ou enchaîner. */}
                <Pressable
                  style={styles.buttonOutline}
                  onPress={() => run(() => correctSet(lastSetIndex, parsedValues()))}
                >
                  <Text style={styles.buttonOutlineText}>Corriger la série {lastSetIndex + 1}</Text>
                </Pressable>
                <Pressable style={styles.button} onPress={beginSet}>
                  <Text style={styles.buttonText}>Série suivante</Text>
                </Pressable>
                <Pressable style={styles.link} onPress={() => run(stopRest)}>
                  <Text style={styles.linkText}>Arrêter le repos</Text>
                </Pressable>
              </>
            ) : (
              <Pressable style={styles.button} onPress={beginSet}>
                <Text style={styles.buttonText}>Démarrer la série {nextSetIndex + 1}</Text>
              </Pressable>
            )}
          </View>

          <Pressable style={styles.buttonOutline} onPress={() => run(goToNextExercise)}>
            <Text style={styles.buttonOutlineText}>Exercice suivant</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.muted}>Aucun exercice en cours.</Text>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.link} onPress={() => setShowFreeExercises((value) => !value)}>
        <Text style={styles.linkText}>
          {showFreeExercises ? 'Masquer' : 'Ajouter un exercice hors programme'}
        </Text>
      </Pressable>
      {showFreeExercises && (
        <View style={styles.chips}>
          {exercises.map((exercise) => (
            <Pressable
              key={exercise.id}
              style={styles.chip}
              onPress={() => run(() => startActivity(exercise.id))}
            >
              <Text style={styles.chipText}>{exercise.name}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <Pressable style={styles.buttonDark} onPress={() => run(finishWorkoutSession)}>
        <Text style={styles.buttonText}>Terminer la séance</Text>
      </Pressable>
      <Pressable style={styles.link} onPress={confirmCancel}>
        <Text style={styles.dangerText}>Annuler la séance</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff', padding: 20 },
  content: { padding: 20, gap: 10, paddingBottom: 60 },
  exerciseTitle: { fontSize: 30, fontWeight: '800', marginBottom: 4 },
  muted: { color: '#71717a' },
  setDone: { color: '#15803d', fontSize: 16 },
  setOther: { color: '#a1a1aa', fontSize: 16 },
  setPlanned: { color: '#d4d4d8', fontSize: 16 },
  actionBlock: {
    backgroundColor: '#f4f4f5', borderRadius: 14, padding: 16, gap: 12, marginTop: 12,
  },
  restRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, justifyContent: 'center' },
  restTimer: { fontSize: 36, fontWeight: '700', fontVariant: ['tabular-nums'] },
  inputRow: { flexDirection: 'row', gap: 12 },
  field: { flex: 1, gap: 4 },
  fieldLabel: { color: '#71717a', fontSize: 12 },
  input: {
    borderWidth: 1, borderColor: '#d4d4d8', borderRadius: 10, backgroundColor: '#fff',
    paddingHorizontal: 12, paddingVertical: 14, fontSize: 20, textAlign: 'center',
  },
  button: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 18, alignItems: 'center' },
  buttonDark: { backgroundColor: '#18181b', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  buttonOutline: { borderWidth: 1, borderColor: '#2563eb', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  buttonOutlineText: { color: '#2563eb', fontWeight: '600', fontSize: 16 },
  link: { paddingVertical: 12, alignItems: 'center' },
  linkText: { color: '#71717a', fontWeight: '600' },
  dangerText: { color: '#dc2626', fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#d4d4d8', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16 },
  chipText: { color: '#3f3f46' },
  error: { color: '#dc2626' },
});
