import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PlannedWorkout } from '../../src/domain/planned-workout/planned-workout';
import { findAll } from '../../src/infra/planned-workout-repository';

export default function WorkoutsScreen() {
  const [workouts, setWorkouts] = useState<PlannedWorkout[]>([]);
  const [error, setError] = useState<string | null>(null);

  // useFocusEffect et non useEffect : on recharge à CHAQUE retour sur l'écran,
  // notamment après avoir créé un entraînement dans l'écran suivant.
  useFocusEffect(
    useCallback(() => {
      findAll().then(setWorkouts).catch((e) => setError(String(e)));
    }, []),
  );

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <Text style={styles.screenTitle}>Entraînements</Text>
      <Link href="/workouts/new" style={styles.button}>
        <Text style={styles.buttonText}>+ Nouvel entraînement</Text>
      </Link>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={workouts}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>Aucun entraînement pour l'instant.</Text>}
        renderItem={({ item }) => {
          const setCount = item.exercises.reduce((total, e) => total + e.sets.length, 0);
          return (
            // asChild : le Link ne rend pas de texte lui-même, il donne son
            // comportement de navigation au composant qu'on lui confie.
            <Link href={`/workouts/${item.id}`} asChild>
              <Pressable style={styles.card}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardSubtitle}>
                  {item.exercises.length} exercice(s) · {setCount} série(s)
                </Text>
              </Pressable>
            </Link>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 16 },
  screenTitle: { fontSize: 26, fontWeight: '800', marginBottom: 12 },
  button: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, textAlign: 'center', marginBottom: 20 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: '#dc2626', marginBottom: 12 },
  empty: { color: '#71717a', fontStyle: 'italic' },
  card: { borderTopWidth: 1, borderTopColor: '#e4e4e7', paddingVertical: 14 },
  cardTitle: { fontSize: 17, fontWeight: '600' },
  cardSubtitle: { color: '#71717a', marginTop: 2 },
});
