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
  const [showSets, setShowSets] = useState(true);
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
  const completedCount = doneSets.filter((set) => set.status === 'COMPLETED').length;
  const totalSets = Math.max(doneSets.length, plannedExercise?.sets.length ?? 0);

  // Le bouton "Corriger" n'apparaît que si les champs diffèrent de ce qui est
  // enregistré : proposer une correction qui ne corrige rien est du bruit.
  const lastSet = lastSetIndex >= 0 ? doneSets[lastSetIndex] : undefined;
  const isCorrected =
    lastSet !== undefined &&
    Object.entries(parsedValues()).some(([id, value]) => lastSet.values[id] !== value);

  /** Le menu de fin de séance : deux actions rares, sorties de l'écran principal. */
  function openSessionMenu() {
    Alert.alert('Séance', undefined, [
      { text: 'Terminer la séance', onPress: () => run(finishWorkoutSession) },
      { text: 'Annuler la séance', style: 'destructive', onPress: confirmCancel },
      { text: 'Continuer', style: 'cancel' },
    ]);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.muted} numberOfLines={1}>
          {plan ? plan.name : 'Séance libre'}
          {position != null && totalExercises > 0
            ? ` · exercice ${position + 1}/${totalExercises}`
            : ''}
        </Text>
        <Pressable style={styles.menuButton} onPress={openSessionMenu} hitSlop={12}>
          <Text style={styles.menuButtonText}>•••</Text>
        </Pressable>
      </View>

      {activity ? (
        <>
          <Text style={styles.exerciseTitle}>{nameOf(activity.exerciseId)}</Text>

          {/* Les séries se replient : pendant l'effort, seul compte ce qui vient. */}
          <Pressable style={styles.setsHeader} onPress={() => setShowSets((value) => !value)}>
            <Text style={styles.setsSummary}>
              {completedCount}/{totalSets || '—'} séries
            </Text>
            <Text style={styles.muted}>{showSets ? 'masquer' : 'voir'}</Text>
          </Pressable>

          {showSets && (
            <ScrollView style={styles.setsList} contentContainerStyle={styles.setsListContent}>
              {doneSets.map((set, index) => (
                <Text
                  key={index}
                  style={set.status === 'COMPLETED' ? styles.setDone : styles.setOther}
                >
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
                    .join(' · ')}
                </Text>
              ))}
            </ScrollView>
          )}

          <View style={styles.spacer} />

          {/* --- Zone d'action, ancrée en bas : un seul état à la fois. --- */}

          {performance?.currentSet ? (
            // Série en cours : rien d'autre à faire que la finir.
            <>
              {!plannedSet && (
                <View style={styles.inputRow}>
                  {(performance?.measurementIds ?? []).map((measurementId) => (
                    <Field
                      key={measurementId}
                      label={unitOf(measurementId)}
                      value={values[measurementId] ?? ''}
                      onChange={(text) =>
                        setValues((current) => ({ ...current, [measurementId]: text }))
                      }
                    />
                  ))}
                </View>
              )}
              <Pressable
                style={styles.buttonBig}
                onPress={() => run(() => completePerformanceSet(parsedValues()))}
              >
                <Text style={styles.buttonText}>Terminer la série {nextSetIndex}</Text>
              </Pressable>
            </>
          ) : session.currentRest ? (
            // Repos : le chrono et la saisie côte à côte, puis la suite.
            <View style={styles.restCard}>
              <View style={styles.restTop}>
                <View style={styles.restTimerBox}>
                  <Text style={styles.restTimer}>
                    {Math.floor(restElapsed / 60)}:{String(restElapsed % 60).padStart(2, '0')}
                  </Text>
                  <Text style={styles.restLabel}>repos</Text>
                </View>

                <View style={styles.restFields}>
                  {(performance?.measurementIds ?? []).map((measurementId) => (
                    <Field
                      key={measurementId}
                      label={unitOf(measurementId)}
                      value={values[measurementId] ?? ''}
                      onChange={(text) =>
                        setValues((current) => ({ ...current, [measurementId]: text }))
                      }
                    />
                  ))}
                </View>
              </View>

              {isCorrected && (
                <Pressable
                  style={styles.buttonOutline}
                  onPress={() => run(() => correctSet(lastSetIndex, parsedValues()))}
                >
                  <Text style={styles.buttonOutlineText}>
                    Corriger la série {lastSetIndex + 1}
                  </Text>
                </Pressable>
              )}

              <View style={styles.buttonRow}>
                <Pressable style={[styles.buttonBig, styles.grow]} onPress={beginSet}>
                  <Text style={styles.buttonText}>Série suivante</Text>
                </Pressable>
                <Pressable
                  style={[styles.buttonOutline, styles.grow]}
                  onPress={() => run(goToNextExercise)}
                >
                  <Text style={styles.buttonOutlineText}>Exercice suivant</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            // Prêt : démarrer la série, ou passer à l'exercice suivant.
            <View style={styles.buttonRow}>
              <Pressable style={[styles.buttonBig, styles.grow]} onPress={beginSet}>
                <Text style={styles.buttonText}>Série {nextSetIndex + 1}</Text>
              </Pressable>
              <Pressable
                style={[styles.buttonOutline, styles.grow]}
                onPress={() => run(goToNextExercise)}
              >
                <Text style={styles.buttonOutlineText}>Exercice suivant</Text>
              </Pressable>
            </View>
          )}

          {error && <Text style={styles.error}>{error}</Text>}
        </>
      ) : (
        <>
          <View style={styles.spacer} />
          <Text style={styles.muted}>Aucun exercice en cours.</Text>
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable style={styles.link} onPress={() => setShowFreeExercises((value) => !value)}>
            <Text style={styles.linkText}>
              {showFreeExercises ? 'Masquer' : 'Choisir un exercice'}
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
        </>
      )}
    </View>
  );
}

/** Un champ de saisie avec son unité : réutilisé pendant la série et le repos. */
function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
}) {
  return (
    <View style={styles.field}>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={value}
        onChangeText={onChange}
      />
      <Text style={styles.fieldLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Pas de ScrollView global : l'écran tient dans la hauteur, seule la liste
  // des séries défile si elle déborde.
  screen: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 8, gap: 10 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  menuButton: { paddingHorizontal: 10, paddingVertical: 4 },
  menuButtonText: { fontSize: 18, color: '#71717a', letterSpacing: 1 },

  exerciseTitle: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },

  setsHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f4f4f5',
  },
  setsSummary: { fontSize: 15, fontWeight: '600', color: '#3f3f46' },
  setsList: { flexShrink: 1 },
  setsListContent: { paddingVertical: 6, gap: 4 },
  setDone: { color: '#15803d', fontSize: 16 },
  setOther: { color: '#a1a1aa', fontSize: 16 },
  setPlanned: { color: '#d4d4d8', fontSize: 16 },

  // Pousse la zone d'action vers le bas de l'écran, à portée du pouce.
  spacer: { flexGrow: 1, minHeight: 12 },

  restCard: { backgroundColor: '#f4f4f5', borderRadius: 16, padding: 16, gap: 12 },
  restTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  restTimerBox: { alignItems: 'center', minWidth: 110 },
  restTimer: { fontSize: 44, fontWeight: '800', fontVariant: ['tabular-nums'], lineHeight: 48 },
  restLabel: { color: '#71717a', fontSize: 13 },
  restFields: { flex: 1, flexDirection: 'row', gap: 10 },

  inputRow: { flexDirection: 'row', gap: 10 },
  field: { flex: 1, alignItems: 'center' },
  input: {
    borderWidth: 1, borderColor: '#d4d4d8', borderRadius: 10, backgroundColor: '#fff',
    paddingVertical: 12, fontSize: 22, fontWeight: '600', textAlign: 'center', width: '100%',
  },
  fieldLabel: { color: '#71717a', fontSize: 12, marginTop: 2 },

  buttonRow: { flexDirection: 'row', gap: 10 },
  grow: { flex: 1 },
  buttonBig: {
    backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  buttonOutline: {
    borderWidth: 1, borderColor: '#c7d2fe', backgroundColor: '#fff', borderRadius: 14,
    paddingVertical: 20, alignItems: 'center', justifyContent: 'center',
  },
  buttonOutlineText: { color: '#2563eb', fontWeight: '600', fontSize: 16 },

  button: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 18, alignItems: 'center' },
  link: { paddingVertical: 12, alignItems: 'center' },
  linkText: { color: '#71717a', fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#d4d4d8', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16 },
  chipText: { color: '#3f3f46' },
  muted: { color: '#71717a', flexShrink: 1 },
  error: { color: '#dc2626' },
});
