import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Exercise } from '../../src/domain/exercise/exercise';
import type { Measurement } from '../../src/domain/exercise/measurement';
import type { PlannedExercise } from '../../src/domain/planned-workout/planned-workout';
import { findAll, findAllMeasurements } from '../../src/infra/exercise-repository';
import { Button } from '../../src/ui/button';
import { Collapsible } from '../../src/ui/collapsible';
import { NumberField } from '../../src/ui/number-field';
import { BusinessNotice } from '../../src/ui/notice';
import { BackHeader } from '../../src/ui/screen-header';
import { createPlannedWorkout } from '../../src/use-cases/create-planned-workout';

const STEPS: Record<string, number> = { reps: 1, weight: 2.5, duration: 1, distance: 10 };

export default function NewWorkoutScreen() {
  const router = useRouter();
  const [available, setAvailable] = useState<Exercise[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [name, setName] = useState('');
  // Le brouillon vit dans l'écran : rien n'est écrit avant validation.
  const [draft, setDraft] = useState<PlannedExercise[]>([]);
  const [inputs, setInputs] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([findAll(), findAllMeasurements()])
      .then(([exercises, allMeasurements]) => {
        setAvailable(exercises);
        setMeasurements(allMeasurements);
      })
      .catch((e) => setError(String(e)));
  }, []);

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

  async function submit() {
    try {
      await createPlannedWorkout({ name, exercises: draft });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-5 pt-4">
        <BackHeader
          title="Nouvel entraînement"
          subtitle="valeurs cibles · aucune date"
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
              {planned.sets.map((set, index) => (
                <Text key={index} className="font-mono text-[14px] text-planned">
                  Série {index + 1} ·{' '}
                  {Object.entries(set.targets)
                    .map(([id, value]) => `${value} ${unitOf(id)}`)
                    .join(' · ')}
                </Text>
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

      <View className="border-t border-border bg-surface p-5 dark:border-border-dark dark:bg-surface-dark">
        <Button label="Enregistrer" size="lg" onPress={submit} />
      </View>
    </SafeAreaView>
  );
}
