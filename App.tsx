import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { createExercise } from './src/app/create-exercise';
import type { Exercise } from './src/domain/exercise/exercise';
import type { Measurement } from './src/domain/exercise/measurement';
import { findAll, findAllMeasurements } from './src/infra/exercise-repository';

export default function App() {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [name, setName] = useState('');
  const [isUnilateral, setIsUnilateral] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Au démarrage : ouverture de la base, migration si besoin, puis lecture.
  useEffect(() => {
    findAllMeasurements().then(setMeasurements).catch((e) => setError(String(e)));
    findAll().then(setExercises).catch((e) => setError(String(e)));
  }, []);

  function toggleMeasurement(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((it) => it !== id) : [...current, id],
    );
  }

  async function submit() {
    try {
      // Aucune validation ici : les règles appartiennent au domaine.
      // L'écran se contente d'afficher le message d'erreur qu'il reçoit.
      await createExercise({ name, isUnilateral, measurementIds: selected });
      setExercises(await findAll());
      setName('');
      setIsUnilateral(false);
      setSelected([]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const measurementName = (id: string) => measurements.find((m) => m.id === id)?.name ?? id;

  return (
    <View style={styles.screen}>
      <StatusBar style="auto" />
      <Text style={styles.title}>Mes exercices</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Nom de l'exercice"
          value={name}
          onChangeText={setName}
        />

        <View style={styles.chips}>
          {measurements.map((m) => {
            const isOn = selected.includes(m.id);
            return (
              <Pressable
                key={m.id}
                onPress={() => toggleMeasurement(m.id)}
                style={[styles.chip, isOn && styles.chipOn]}
              >
                <Text style={isOn ? styles.chipTextOn : styles.chipText}>
                  {m.name} ({m.unit})
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Exercice unilatéral</Text>
          <Switch value={isUnilateral} onValueChange={setIsUnilateral} />
        </View>

        <Pressable style={styles.button} onPress={submit}>
          <Text style={styles.buttonText}>Créer l'exercice</Text>
        </Pressable>

        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      <FlatList
        data={exercises}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>Aucun exercice pour l'instant.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {item.name}
              {item.isUnilateral ? '  ·  unilatéral' : ''}
            </Text>
            <Text style={styles.cardSubtitle}>
              {item.measurementIds.map(measurementName).join(' · ')}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 70 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 16 },
  form: { gap: 12, marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#d4d4d8', borderRadius: 10, padding: 12, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#d4d4d8', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  chipOn: { backgroundColor: '#18181b', borderColor: '#18181b' },
  chipText: { color: '#3f3f46' },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 16 },
  button: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: '#dc2626' },
  empty: { color: '#71717a', fontStyle: 'italic' },
  card: { borderTopWidth: 1, borderTopColor: '#e4e4e7', paddingVertical: 14 },
  cardTitle: { fontSize: 17, fontWeight: '600' },
  cardSubtitle: { color: '#71717a', marginTop: 2 },
});
