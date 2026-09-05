import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Exercise } from '../src/domain/exercise/exercise';
import type { Measurement } from '../src/domain/exercise/measurement';
import type { Metric, ProgressionStep } from '../src/domain/goal/goal';
import { findAll as findAllExercises, findAllMeasurements } from '../src/infra/exercise-repository';
import { Button } from '../src/ui/button';
import { Card } from '../src/ui/card';
import { NumberField } from '../src/ui/number-field';
import { BusinessNotice } from '../src/ui/notice';
import { BackHeader } from '../src/ui/screen-header';
import { Sheet } from '../src/ui/sheet';
import { createGoal } from '../src/use-cases/goal-actions';

const METRIC_LABELS: Record<Metric['type'], string> = {
  average: 'Moyenne',
  max: 'Meilleure',
  min: 'Minimum',
  total: 'Total',
  setCount: 'Nombre de séries',
};

export default function NewGoalScreen() {
  const router = useRouter();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [name, setName] = useState('');
  const [steps, setSteps] = useState<ProgressionStep[]>([]);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([findAllExercises(), findAllMeasurements()])
      .then(([all, allMeasurements]) => {
        setExercises(all);
        setMeasurements(allMeasurements);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const exerciseOf = (id: string) => exercises.find((e) => e.id === id);
  const unitOf = (id: string) => measurements.find((m) => m.id === id)?.unit ?? id;

  /** Une étape naît avec une condition par défaut, à ajuster ensuite. */
  function addStep(exerciseId: string) {
    const exercise = exerciseOf(exerciseId);
    const measurementId = exercise?.measurementIds[0];
    if (!measurementId) return;

    setSteps((current) => [
      ...current,
      {
        exerciseId,
        requirements: [
          {
            conditions: [
              { metric: { type: 'average', measurementId }, operator: '>=', value: 10 },
            ],
          },
        ],
      },
    ]);
  }

  function updateCondition(stepIndex: number, changes: { metric?: Metric; value?: number }) {
    setSteps((current) =>
      current.map((step, index) => {
        if (index !== stepIndex) return step;
        const condition = step.requirements[0].conditions[0];
        return {
          ...step,
          requirements: [
            {
              conditions: [
                {
                  metric: changes.metric ?? condition.metric,
                  operator: condition.operator,
                  value: changes.value ?? condition.value,
                },
              ],
            },
          ],
        };
      }),
    );
  }

  async function submit() {
    try {
      await createGoal({ name, steps });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-5 pt-4">
        <BackHeader
          title="Nouvel objectif"
          subtitle="une étape par exercice, dans l'ordre"
          onBack={() => router.back()}
        />
      </View>

      <ScrollView contentContainerClassName="gap-4 px-5 pb-8">
        <TextInput
          className="h-14 rounded-lg border-2 border-border bg-surface px-4 text-[17px] text-ink dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
          placeholder="Front Lever"
          placeholderTextColor="#A8AD9E"
          value={name}
          onChangeText={setName}
        />

        {steps.map((step, index) => {
          const exercise = exerciseOf(step.exerciseId);
          const condition = step.requirements[0].conditions[0];
          const metric = condition.metric;

          return (
            <Card key={`${step.exerciseId}-${index}`} density="titled" className="gap-3">
              <Text className="font-bold text-[16px] text-ink dark:text-ink-dark">
                {index + 1}. {exercise?.name ?? step.exerciseId}
              </Text>

              {/* La métrique évaluée : moyenne, meilleure, total, ou le
                  nombre de séries complétées. */}
              <View className="flex-row flex-wrap gap-2">
                {(['average', 'max', 'total', 'setCount'] as const).map((type) => {
                  const on = metric.type === type;
                  const measurementId =
                    metric.type === 'setCount' ? exercise?.measurementIds[0] : metric.measurementId;
                  return (
                    <Pressable
                      key={type}
                      onPress={() =>
                        updateCondition(index, {
                          metric:
                            type === 'setCount'
                              ? { type: 'setCount' }
                              : { type, measurementId: measurementId! },
                        })
                      }
                      className={
                        on
                          ? 'h-10 justify-center rounded-full bg-primary px-3'
                          : 'h-10 justify-center rounded-full border border-border bg-surface px-3 dark:border-border-dark dark:bg-surface-dark'
                      }
                    >
                      <Text
                        className={
                          on ? 'font-bold text-[13px] text-ink' : 'text-[13px] text-muted dark:text-muted-dark'
                        }
                      >
                        {METRIC_LABELS[type]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Sur quelle mesure, quand l'exercice en a plusieurs. */}
              {metric.type !== 'setCount' && (exercise?.measurementIds.length ?? 0) > 1 && (
                <View className="flex-row flex-wrap gap-2">
                  {exercise?.measurementIds.map((measurementId) => {
                    const on = metric.measurementId === measurementId;
                    return (
                      <Pressable
                        key={measurementId}
                        onPress={() =>
                          updateCondition(index, { metric: { type: metric.type, measurementId } })
                        }
                        className={
                          on
                            ? 'h-10 justify-center rounded-full bg-primary-soft px-3 dark:bg-primary-soft-dark'
                            : 'h-10 justify-center rounded-full border border-border px-3 dark:border-border-dark'
                        }
                      >
                        <Text className="text-[13px] text-muted dark:text-muted-dark">
                          {unitOf(measurementId)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              <View className="flex-row items-end gap-3">
                <Text className="mb-4 text-[15px] text-muted dark:text-muted-dark">au moins</Text>
                <NumberField
                  unit={metric.type === 'setCount' ? 'séries' : unitOf(metric.measurementId)}
                  value={condition.value}
                  step={metric.type === 'setCount' ? 1 : 1}
                  onChange={(value) => updateCondition(index, { value })}
                />
              </View>
            </Card>
          );
        })}

        <Button
          label="+ Ajouter une étape"
          variant="secondary"
          size="md"
          onPress={() => setPicking(true)}
        />

        {error && <BusinessNotice message={error} />}
      </ScrollView>

      <View className="p-5 pt-2">
        <Button label="Créer l'objectif" size="lg" onPress={submit} />
      </View>

      <Sheet
        visible={picking}
        title="Ajouter une étape"
        description="Chaque étape est un exercice. L'ordre définit la progression."
        searchPlaceholder="Rechercher un exercice"
        actions={exercises.map((exercise) => ({
          label: exercise.name,
          onPress: () => addStep(exercise.id),
        }))}
        onClose={() => setPicking(false)}
      />
    </SafeAreaView>
  );
}
