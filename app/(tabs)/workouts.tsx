import { Link, useFocusEffect } from 'expo-router';
import { useNotifications } from '../../src/ui/notifications';
import { messageOf } from '../../src/ui/message';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Exercise } from '../../src/domain/exercise/exercise';
import type { PlannedWorkout } from '../../src/domain/planned-workout/planned-workout';
import { findAll as findAllExercises, findAllMuscles } from '../../src/infra/exercise-repository';
import type { Muscle } from '../../src/domain/exercise/muscle';
import { listActiveWorkouts } from '../../src/use-cases/edit-catalogue';
import { Card } from '../../src/ui/card';
import { EmptyState } from '../../src/ui/empty-state';
import { Fab } from '../../src/ui/fab';
import { MuscleFilterChip, MuscleFilterSheet } from '../../src/ui/muscle-filter';
import { SectionHeader } from '../../src/ui/screen-header';
import { SearchField } from '../../src/ui/search';
import { fold } from '../../src/text';
import { MetaLine } from '../../src/ui/meta-line';

export default function WorkoutsScreen() {
  const { notify } = useNotifications();
  const [workouts, setWorkouts] = useState<PlannedWorkout[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [muscles, setMuscles] = useState<Muscle[]>([]);
  const [query, setQuery] = useState('');
  /** Les muscles retenus au filtre. Vide : tout voir. */
  const [filter, setFilter] = useState<string[]>([]);
  const [filtering, setFiltering] = useState(false);

  useFocusEffect(
    useCallback(() => {
      Promise.all([listActiveWorkouts(), findAllExercises(), findAllMuscles()])
        .then(([plans, allExercises, allMuscles]) => {
          setWorkouts(plans);
          setExercises(allExercises);
          setMuscles(allMuscles);
        })
        .catch((e) => notify(messageOf(e)));
    }, []),
  );

  const nameOf = (id: string) => exercises.find((e) => e.id === id)?.name ?? id;

  /** Les muscles qu'un entraînement travaille : ceux de ses exercices. */
  const musclesOf = (workout: PlannedWorkout) =>
    workout.exercises.flatMap(
      (planned) => exercises.find((e) => e.id === planned.exerciseId)?.muscleIds ?? [],
    );

  // Ne proposer au filtre que les muscles réellement travaillés : une liste
  // de douze entrées dont dix ne donnent rien n'aide personne.
  const usedMuscles = muscles.filter((muscle) =>
    workouts.some((workout) => musclesOf(workout).includes(muscle.id)),
  );

  const shown = workouts
    .filter(
      (workout) =>
        filter.length === 0 || musclesOf(workout).some((id) => filter.includes(id)),
    )
    // La recherche porte aussi sur les exercices : « dips » doit retrouver
    // l'entraînement qui en contient, quel que soit son nom.
    .filter((workout) => {
      const needle = fold(query.trim());
      if (needle === '') return true;
      return (
        fold(workout.name).includes(needle) ||
        workout.exercises.some((planned) => fold(nameOf(planned.exerciseId)).includes(needle))
      );
    });

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background px-5 pt-4 dark:bg-background-dark">
      <SectionHeader
        title="Entraînements"
        subtitle={`${workouts.length} programme${workouts.length > 1 ? 's' : ''} réutilisable${workouts.length > 1 ? 's' : ''}`}
      />

      <View className="gap-3 pb-3">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Chercher un entraînement"
        />
        {usedMuscles.length > 0 && (
          <MuscleFilterChip
            muscles={usedMuscles}
            selected={filter}
            onPress={() => setFiltering(true)}
          />
        )}
      </View>

      <FlatList
        keyboardShouldPersistTaps="handled"
        data={shown}
        keyExtractor={(item) => item.id}
        // La liste s'arrête au-dessus de la pastille d'ajout.
        contentContainerClassName="grow gap-3 pb-28"
        ListEmptyComponent={
          workouts.length === 0 ? (
            <EmptyState
              title="Aucun entraînement"
              description="Un entraînement regroupe des exercices et leurs séries cibles. Il est réutilisable, sans date."
            />
          ) : (
            <EmptyState
              title="Aucun résultat"
              description="Aucun entraînement ne correspond à cette recherche."
            />
          )
        }
        renderItem={({ item }) => {
          const setCount = item.exercises.reduce((total, e) => total + e.sets.length, 0);
          return (
            <Link href={{ pathname: '/workout', params: { id: item.id } }} asChild>
              <Pressable>
                <Card density="titled">
                  <Text className="font-extrabold text-body text-ink dark:text-ink-dark">
                    {item.name}
                  </Text>
                  {/* Ce que l'entraînement contient, en chiffres seulement : la
                      liste des exercices alourdissait chaque carte, et sa
                      fiche la donne. La même ligne que dans le lanceur. */}
                  <MetaLine
                    items={[
                      {
                        icon: 'barbell-outline',
                        label: `${item.exercises.length} exercice${item.exercises.length > 1 ? 's' : ''}`,
                      },
                      {
                        icon: 'layers-outline',
                        label: `${setCount} série${setCount > 1 ? 's' : ''}`,
                      },
                    ]}
                  />
                </Card>
              </Pressable>
            </Link>
          );
        }}
      />


      <Link href="/new-workout" asChild>
        <Fab accessibilityLabel="Nouvel entraînement" />
      </Link>

      <MuscleFilterSheet
        visible={filtering}
        muscles={usedMuscles}
        selected={filter}
        results={shown.length}
        onToggle={(id) =>
          setFilter((current) =>
            current.includes(id) ? current.filter((m) => m !== id) : [...current, id],
          )
        }
        onClear={() => setFilter([])}
        onClose={() => setFiltering(false)}
      />
    </SafeAreaView>
  );
}
