import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { messageOf } from '../../src/ui/message';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Exercise } from '../../src/domain/exercise/exercise';
import type { Measurement } from '../../src/domain/exercise/measurement';
import type { PlannedExercise } from '../../src/domain/planned-workout/planned-workout';
import { findAllMeasurements } from '../../src/infra/exercise-repository';
import { listActiveExercises } from '../../src/use-cases/edit-catalogue';
import { Button } from '../../src/ui/button';
import { Collapsible } from '../../src/ui/collapsible';
import { NumberField } from '../../src/ui/number-field';
import { BusinessNotice } from '../../src/ui/notice';
import { BackHeader } from '../../src/ui/screen-header';
import {
  createPlannedWorkout,
  updatePlannedWorkout,
} from '../../src/use-cases/create-planned-workout';
import { findAll as findAllPlans } from '../../src/infra/planned-workout-repository';
import type { PlannedWorkout } from '../../src/domain/planned-workout/planned-workout';

const STEPS: Record<string, number> = { reps: 1, weight: 2.5, duration: 1, distance: 10 };

/**
 * Création ET édition : un identifiant dans la route fait passer l'écran en
 * mode édition. Le brouillon vit dans l'écran, rien n'est écrit avant
 * validation -- y compris quand on modifie un entraînement existant.
 */
export default function NewWorkoutScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [existing, setExisting] = useState<PlannedWorkout | null>(null);
  const [available, setAvailable] = useState<Exercise[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [name, setName] = useState('');
  // Le brouillon vit dans l'écran : rien n'est écrit avant validation.
  const [draft, setDraft] = useState<PlannedExercise[]>([]);
  const [inputs, setInputs] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  // Les exercices disponibles se rechargent à chaque affichage...
  useFocusEffect(
    useCallback(() => {
      Promise.all([listActiveExercises(), findAllMeasurements()])
        .then(([exercises, allMeasurements]) => {
          setAvailable(exercises);
          setMeasurements(allMeasurements);
        })
        .catch((e) => setError(messageOf(e)));
    }, []),
  );

  // ...mais le brouillon en cours d'édition une seule fois.
  useEffect(() => {
    if (!id) return;
    findAllPlans()
      .then((plans) => {
        const plan = plans.find((candidate) => candidate.id === id);
        if (!plan) return;
        setExisting(plan);
        setName(plan.name);
        setDraft([...plan.exercises]);
      })
      .catch((e) => setError(messageOf(e)));
  }, [id]);

  const exerciseOf = (id: string) => available.find((e) => e.id === id);
  const unitOf = (id: string) => measurements.find((m) => m.id === id)?.unit ?? id;

  function addSet(position: number) {
    const exercise = exerciseOf(draft[position].exerciseId);
    if (!exercise) return;

    const targets: Record<string, number> = {};
    for (const measurementId of exercise.measurementIds) {
      const value = inputs[`${position}|${measurementId}`];
      if (value !== undefined) targets[measurementId] = value;
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

  function removeExercise(position: number) {
    setDraft((current) => current.filter((_, index) => index !== position));
  }

  function removeSet(position: number, setIndex: number) {
    setDraft((current) =>
      current.map((planned, index) =>
        index === position
          ? { ...planned, sets: planned.sets.filter((_, i) => i !== setIndex) }
          : planned,
      ),
    );
  }

  async function submit() {
    try {
      if (existing) {
        await updatePlannedWorkout({ workout: existing, name, exercises: draft });
      } else {
        await createPlannedWorkout({ name, exercises: draft });
      }
      router.back();
    } catch (e) {
      setError(messageOf(e));
    }
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-5 pt-4">
        <BackHeader
          title={existing ? "Modifier l'entraînement" : 'Nouvel entraînement'}
          subtitle={
            existing ? 'les séances passées ne changent pas' : 'valeurs cibles · aucune date'
          }
          onBack={() => router.back()}
        />
      </View>

      <ScrollView contentContainerClassName="gap-4 px-5 pb-8">
        <TextInput
          className="h-14 rounded-lg border-[1.5px] border-border bg-surface px-4 text-[17px] text-ink dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
          placeholder="Nom de l'entraînement"
          placeholderTextColor="#A8AD9E"
          value={name}
          onChangeText={setName}
        />

        {draft.map((planned, position) => {
          const exercise = exerciseOf(planned.exerciseId);
          return (
            <Collapsible
              key={`${planned.exerciseId}-${position}`}
              title={exercise?.name ?? planned.exerciseId}
              summary={`${planned.sets.length} série${planned.sets.length > 1 ? 's' : ''}`}
              defaultOpen
            >
              <Pressable onPress={() => removeExercise(position)} hitSlop={8} className="pb-1">
                <Text className="text-[12px] text-danger dark:text-danger-dark">
                  Retirer cet exercice
                </Text>
              </Pressable>
              {planned.sets.map((set, index) => (
                <View key={index} className="flex-row items-center justify-between gap-3">
                  <Text className="shrink font-mono text-[14px] text-planned">
                    Série {index + 1} ·{' '}
                    {Object.entries(set.targets)
                      .map(([id, value]) => `${value} ${unitOf(id)}`)
                      .join(' · ')}
                  </Text>
                  <Pressable onPress={() => removeSet(position, index)} hitSlop={8}>
                    <Text className="text-[12px] text-danger dark:text-danger-dark">retirer</Text>
                  </Pressable>
                </View>
              ))}

              <View className="mt-2 flex-row gap-2">
                {exercise?.measurementIds.map((measurementId) => (
                  <NumberField
                    key={measurementId}
                    unit={unitOf(measurementId)}
                    value={inputs[`${position}|${measurementId}`] ?? 0}
                    step={STEPS[measurementId] ?? 1}
                    onChange={(value) =>
                      setInputs((current) => ({ ...current, [`${position}|${measurementId}`]: value }))
                    }
                  />
                ))}
              </View>
              <Button
                label="+ Ajouter cette série"
                variant="secondary"
                size="md"
                className="mt-2"
                onPress={() => addSet(position)}
              />
            </Collapsible>
          );
        })}

        <View className="gap-2">
          <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
            Ajouter un exercice
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {available.map((exercise) => (
              <Pressable
                key={exercise.id}
                onPress={() =>
                  setDraft((current) => [...current, { exerciseId: exercise.id, sets: [] }])
                }
                className="h-12 items-center justify-center rounded-full border border-dashed border-border-strong px-4 dark:border-border-strong-dark"
              >
                <Text className="font-medium text-muted dark:text-muted-dark">{exercise.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {error && <BusinessNotice message={error} />}
      </ScrollView>

      <View className="p-5 pt-2">
        <Button
          label={existing ? 'Enregistrer les modifications' : 'Créer l entraînement'}
          size="lg"
          onPress={submit}
        />
      </View>
    </SafeAreaView>
  );
}
