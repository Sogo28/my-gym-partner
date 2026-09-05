import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createPlannedWorkout } from '../../src/use-cases/create-planned-workout';
import type { Exercise } from '../../src/domain/exercise/exercise';
import type { Measurement } from '../../src/domain/exercise/measurement';
import type { PlannedExercise } from '../../src/domain/planned-workout/planned-workout';
import { findAll, findAllMeasurements } from '../../src/infra/exercise-repository';

export default function NewWorkoutScreen() {
  const router = useRouter();
  const [available, setAvailable] = useState<Exercise[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [name, setName] = useState('');
  // Le brouillon vit dans l'écran : rien n'est écrit en base avant validation.
  const [draft, setDraft] = useState<PlannedExercise[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    findAll().then(setAvailable).catch((e) => setError(String(e)));
    findAllMeasurements().then(setMeasurements).catch((e) => setError(String(e)));
  }, []);

  const measurementOf = (id: string) => measurements.find((m) => m.id === id);
  const exerciseOf = (id: string) => available.find((e) => e.id === id);

  function addExercise(exerciseId: string) {
    setDraft((current) => [...current, { exerciseId, sets: [] }]);
  }

  function addSet(position: number) {
    const exercise = exerciseOf(draft[position].exerciseId);
    if (!exercise) return;

    const targets: Record<string, number> = {};
    for (const measurementId of exercise.measurementIds) {
      const raw = inputs[`${position}|${measurementId}`];
      if (raw !== undefined && raw.trim() !== '') {
        targets[measurementId] = Number(raw.replace(',', '.'));
      }
    }

    if (Object.keys(targets).length === 0) {
      setError('Renseigne au moins une valeur pour cette série.');
      return;
    }

    setDraft((current) =>
      current.map((planned, i) =>
        i === position ? { ...planned, sets: [...planned.sets, { targets }] } : planned,
      ),
    );
    setError(null);
  }

  async function submit() {
    try {
      await createPlannedWorkout({ name, exercises: draft });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>Nouvel entraînement</Text>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.close}>Fermer</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
      <TextInput
        style={styles.input}
        placeholder="Nom de l'entraînement (ex. Pull day)"
        value={name}
        onChangeText={setName}
      />

      {draft.map((planned, position) => {
        const exercise = exerciseOf(planned.exerciseId);
        return (
          <View key={`${planned.exerciseId}-${position}`} style={styles.block}>
            <Text style={styles.blockTitle}>{exercise?.name ?? planned.exerciseId}</Text>

            {planned.sets.map((set, index) => (
              <Text key={index} style={styles.setLine}>
                Série {index + 1} :{' '}
                {Object.entries(set.targets)
                  .map(([id, value]) => `${value} ${measurementOf(id)?.unit ?? id}`)
                  .join(' · ')}
              </Text>
            ))}

            <View style={styles.targetRow}>
              {exercise?.measurementIds.map((measurementId) => (
                <TextInput
                  key={measurementId}
                  style={styles.smallInput}
                  keyboardType="numeric"
                  placeholder={measurementOf(measurementId)?.unit ?? measurementId}
                  value={inputs[`${position}|${measurementId}`] ?? ''}
                  onChangeText={(text) =>
                    setInputs((current) => ({ ...current, [`${position}|${measurementId}`]: text }))
                  }
                />
              ))}
              <Pressable style={styles.smallButton} onPress={() => addSet(position)}>
                <Text style={styles.smallButtonText}>+ série</Text>
              </Pressable>
            </View>
          </View>
        );
      })}

      <Text style={styles.sectionTitle}>Ajouter un exercice</Text>
      <View style={styles.chips}>
        {available.map((exercise) => (
          <Pressable key={exercise.id} style={styles.chip} onPress={() => addExercise(exercise.id)}>
            <Text style={styles.chipText}>{exercise.name}</Text>
          </Pressable>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={submit}>
        <Text style={styles.buttonText}>Enregistrer l'entraînement</Text>
      </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16 },
  screenTitle: { fontSize: 22, fontWeight: '800' },
  close: { color: '#71717a', fontWeight: '600' },
  content: { padding: 20, gap: 16, paddingBottom: 60 },
  input: { borderWidth: 1, borderColor: '#d4d4d8', borderRadius: 10, padding: 12, fontSize: 16 },
  block: { borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 10, padding: 12, gap: 8 },
  blockTitle: { fontSize: 16, fontWeight: '600' },
  setLine: { color: '#3f3f46' },
  targetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  smallInput: {
    borderWidth: 1, borderColor: '#d4d4d8', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, minWidth: 70,
  },
  smallButton: { backgroundColor: '#18181b', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  smallButtonText: { color: '#fff', fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#d4d4d8', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  chipText: { color: '#3f3f46' },
  error: { color: '#dc2626' },
  button: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
