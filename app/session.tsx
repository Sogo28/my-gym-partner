import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  abandonPerformanceSet,
  cancelWorkoutSession,
  completePerformanceSet,
  finishActivity,
  finishWorkoutSession,
  startActivity,
  startPerformanceSet,
  startWorkoutSession,
} from '../src/use-cases/workout-session-actions';
import type { Exercise } from '../src/domain/exercise/exercise';
import type { Measurement } from '../src/domain/exercise/measurement';
import type { ExercisePerformance } from '../src/domain/performance/exercise-performance';
import type { PlannedWorkout } from '../src/domain/planned-workout/planned-workout';
import type { WorkoutSession } from '../src/domain/workout-session/workout-session';
import { findAll as findAllExercises, findAllMeasurements } from '../src/infra/exercise-repository';
import { findById as findPerformanceById } from '../src/infra/performance-repository';
import { findAll as findAllPlans } from '../src/infra/planned-workout-repository';
import { findActive } from '../src/infra/workout-session-repository';

export default function SessionScreen() {
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [performance, setPerformance] = useState<ExercisePerformance | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [plans, setPlans] = useState<PlannedWorkout[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
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

  // Toutes les actions suivent le même chemin : appeler le use case, recharger
  // depuis la base, ou afficher le refus du domaine.
  async function run(action: () => Promise<unknown>) {
    try {
      await action();
      await reload();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function submitSet() {
    const parsed: Record<string, number> = {};
    for (const [measurementId, raw] of Object.entries(values)) {
      if (raw.trim() !== '') parsed[measurementId] = Number(raw.replace(',', '.'));
    }
    run(async () => {
      await completePerformanceSet(parsed);
      setValues({});
    });
  }

  const nameOf = (exerciseId: string) =>
    exercises.find((e) => e.id === exerciseId)?.name ?? exerciseId;
  const unitOf = (measurementId: string) =>
    measurements.find((m) => m.id === measurementId)?.unit ?? measurementId;

  function confirmCancel() {
    Alert.alert('Annuler la séance ?', 'Les exercices déjà enregistrés seront conservés.', [
      { text: 'Continuer la séance', style: 'cancel' },
      { text: 'Annuler la séance', style: 'destructive', onPress: () => run(cancelWorkoutSession) },
    ]);
  }

  if (!session) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Démarrer depuis un entraînement</Text>
        {plans.length === 0 && <Text style={styles.muted}>Aucun entraînement planifié.</Text>}
        {plans.map((plan) => (
          <Pressable
            key={plan.id}
            style={styles.card}
            onPress={() => run(() => startWorkoutSession(plan.id))}
          >
            <Text style={styles.cardTitle}>{plan.name}</Text>
            <Text style={styles.muted}>{plan.exercises.length} exercice(s)</Text>
          </Pressable>
        ))}

        <Pressable style={styles.button} onPress={() => run(() => startWorkoutSession())}>
          <Text style={styles.buttonText}>Séance libre</Text>
        </Pressable>

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
    );
  }

  const plan = plans.find((p) => p.id === session.plannedWorkoutId);
  const current = session.currentActivity;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>{plan ? plan.name : 'Séance libre'}</Text>
        <Text style={styles.muted}>
          Démarrée à {session.startedAt.getHours()}h
          {String(session.startedAt.getMinutes()).padStart(2, '0')}
        </Text>
      </View>

      {current ? (
        <View style={styles.currentBlock}>
          <Text style={styles.muted}>En cours</Text>
          <Text style={styles.currentTitle}>{nameOf(current.exerciseId)}</Text>

          {performance?.sets.map((set, index) => (
            <Text key={index} style={set.status === 'COMPLETED' ? styles.setDone : styles.setOther}>
              Série {index + 1} ·{' '}
              {set.status === 'IN_PROGRESS'
                ? 'en cours'
                : Object.entries(set.values)
                    .map(([id, value]) => `${value} ${unitOf(id)}`)
                    .join(' · ') || 'abandonnée'}
              {set.status === 'ABANDONED' ? '  (abandonnée)' : ''}
            </Text>
          ))}

          {performance?.currentSet ? (
            <>
              <View style={styles.targetRow}>
                {performance.measurementIds.map((measurementId) => (
                  <TextInput
                    key={measurementId}
                    style={styles.smallInput}
                    keyboardType="numeric"
                    placeholder={unitOf(measurementId)}
                    value={values[measurementId] ?? ''}
                    onChangeText={(text) =>
                      setValues((current) => ({ ...current, [measurementId]: text }))
                    }
                  />
                ))}
              </View>
              <Pressable style={styles.button} onPress={submitSet}>
                <Text style={styles.buttonText}>Valider la série</Text>
              </Pressable>
              <Pressable style={styles.buttonGhost} onPress={() => run(abandonPerformanceSet)}>
                <Text style={styles.buttonGhostText}>Abandonner la série</Text>
              </Pressable>
            </>
          ) : (
            <Pressable style={styles.button} onPress={() => run(startPerformanceSet)}>
              <Text style={styles.buttonText}>Démarrer une série</Text>
            </Pressable>
          )}

          <Pressable style={styles.buttonOutline} onPress={() => run(finishActivity)}>
            <Text style={styles.buttonOutlineText}>Terminer cet exercice</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.muted}>Aucun exercice en cours.</Text>
      )}

      {plan && (
        <>
          <Text style={styles.sectionTitle}>Au programme</Text>
          {plan.exercises.map((planned, position) => (
            <Pressable
              key={`${planned.exerciseId}-${position}`}
              style={styles.card}
              onPress={() => run(() => startActivity(planned.exerciseId))}
            >
              <Text style={styles.cardTitle}>{nameOf(planned.exerciseId)}</Text>
              <Text style={styles.muted}>{planned.sets.length} série(s) prévue(s)</Text>
            </Pressable>
          ))}
        </>
      )}

      <Text style={styles.sectionTitle}>Ajouter un exercice</Text>
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

      {session.activities.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Déjà fait</Text>
          {session.activities.map((activity, index) => (
            <Text key={index} style={styles.muted}>
              {nameOf(activity.exerciseId)}
              {activity.finishedAt ? '' : '  ·  en cours'}
            </Text>
          ))}
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={() => run(finishWorkoutSession)}>
        <Text style={styles.buttonText}>Terminer la séance</Text>
      </Pressable>
      <Pressable style={styles.buttonGhost} onPress={confirmCancel}>
        <Text style={styles.buttonGhostText}>Annuler la séance</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, gap: 12, paddingBottom: 60 },
  banner: { backgroundColor: '#eff6ff', borderRadius: 10, padding: 14 },
  bannerTitle: { fontSize: 18, fontWeight: '700' },
  currentBlock: { borderWidth: 2, borderColor: '#2563eb', borderRadius: 10, padding: 14, gap: 8 },
  currentTitle: { fontSize: 20, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 10 },
  card: { borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 10, padding: 14 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  muted: { color: '#71717a' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#d4d4d8', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  chipText: { color: '#3f3f46' },
  button: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonGhost: { paddingVertical: 12, alignItems: 'center' },
  buttonGhostText: { color: '#dc2626', fontWeight: '600' },
  error: { color: '#dc2626' },
  setDone: { color: '#15803d' },
  setOther: { color: '#a1a1aa' },
  targetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  smallInput: {
    borderWidth: 1, borderColor: '#d4d4d8', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, minWidth: 70,
  },
  buttonOutline: { borderWidth: 1, borderColor: '#2563eb', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  buttonOutlineText: { color: '#2563eb', fontWeight: '600' },
});
