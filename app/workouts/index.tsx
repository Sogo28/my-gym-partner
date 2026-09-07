import { Link, useFocusEffect } from 'expo-router';
import { messageOf } from '../../src/ui/message';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Exercise } from '../../src/domain/exercise/exercise';
import type { PlannedWorkout } from '../../src/domain/planned-workout/planned-workout';
import { findAll as findAllExercises } from '../../src/infra/exercise-repository';
import { listActiveWorkouts } from '../../src/use-cases/edit-catalogue';
import { Card } from '../../src/ui/card';
import { EmptyState } from '../../src/ui/empty-state';
import { Fab } from '../../src/ui/fab';
import { SectionHeader } from '../../src/ui/screen-header';

export default function WorkoutsScreen() {
  const [workouts, setWorkouts] = useState<PlannedWorkout[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      Promise.all([listActiveWorkouts(), findAllExercises()])
        .then(([plans, allExercises]) => {
          setWorkouts(plans);
          setExercises(allExercises);
        })
        .catch((e) => setError(messageOf(e)));
    }, []),
  );

  const nameOf = (id: string) => exercises.find((e) => e.id === id)?.name ?? id;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background px-5 pt-4 dark:bg-background-dark">
      <SectionHeader
        title="Entraînements"
        subtitle={`${workouts.length} programme${workouts.length > 1 ? 's' : ''} réutilisable${workouts.length > 1 ? 's' : ''}`}
      />

      <FlatList
        data={workouts}
        keyExtractor={(item) => item.id}
        // La liste s'arrête au-dessus de la pastille d'ajout.
        contentContainerClassName="gap-3 pb-28"
        ListEmptyComponent={
          <EmptyState
            title="Aucun entraînement"
            description="Un entraînement regroupe des exercices et leurs séries cibles. Il est réutilisable, sans date."
          />
        }
        renderItem={({ item }) => {
          const setCount = item.exercises.reduce((total, e) => total + e.sets.length, 0);
          return (
            <Link href={`/workouts/${item.id}`} asChild>
              <Pressable>
                <Card density="titled">
                  <Text className="font-extrabold text-heading text-ink dark:text-ink-dark">
                    {item.name}
                  </Text>
                  <Text className="font-mono text-[12px] text-muted dark:text-muted-dark">
                    {item.exercises.length} ex · {setCount} série{setCount > 1 ? 's' : ''}
                  </Text>
                  {item.exercises.length > 0 && (
                    <Text
                      className="mt-1 text-[13px] text-muted dark:text-muted-dark"
                      numberOfLines={2}
                    >
                      {item.exercises.map((e) => nameOf(e.exerciseId)).join(' · ')}
                    </Text>
                  )}
                </Card>
              </Pressable>
            </Link>
          );
        }}
      />

      {error && <Text className="pb-2 text-danger dark:text-danger-dark">{error}</Text>}

      <Link href="/workouts/new" asChild>
        <Fab accessibilityLabel="Nouvel entraînement" />
      </Link>
    </SafeAreaView>
  );
}
