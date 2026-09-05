import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Exercise } from '../src/domain/exercise/exercise';
import type { Measurement } from '../src/domain/exercise/measurement';
import type { Aggregation, Condition, ProgressionStep } from '../src/domain/goal/goal';
import { findAll as findAllExercises, findAllMeasurements } from '../src/infra/exercise-repository';
import { Button } from '../src/ui/button';
import { Card } from '../src/ui/card';
import { NumberField } from '../src/ui/number-field';
import { BusinessNotice } from '../src/ui/notice';
import { BackHeader } from '../src/ui/screen-header';
import { Sheet } from '../src/ui/sheet';
import { createGoal } from '../src/use-cases/goal-actions';

const AGGREGATIONS: { value: Aggregation; label: string }[] = [
  { value: 'average', label: 'Moyenne' },
  { value: 'max', label: 'Meilleure' },
  { value: 'min', label: 'Minimum' },
  { value: 'total', label: 'Total' },
  { value: 'setCount', label: 'Séries' },
];

/** Une entrée de l'écran : un exercice et sa condition. */
type Entry = { exerciseId: string; condition: Condition };

export default function NewGoalScreen() {
  const router = useRouter();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [name, setName] = useState('');
  const [progressive, setProgressive] = useState(true);
  const [entries, setEntries] = useState<Entry[]>([]);
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

  function addEntry(exerciseId: string) {
    const measurementId = exerciseOf(exerciseId)?.measurementIds[0];
    if (!measurementId) return;

    const entry: Entry = {
      exerciseId,
      condition: {
        measurementId,
        window: 'LAST_SESSION',
        aggregation: 'average',
        operator: '>=',
        target: 10,
      },
    };
    // Un objectif simple ne vise qu'un exercice : le nouveau remplace l'ancien.
    setEntries((current) => (progressive ? [...current, entry] : [entry]));
  }

  function update(index: number, changes: Partial<Condition>) {
    setEntries((current) =>
      current.map((entry, i) =>
        i === index ? { ...entry, condition: { ...entry.condition, ...changes } } : entry,
      ),
    );
  }

  async function submit() {
    try {
      if (entries.length === 0) {
        throw new Error('Ajoute au moins un exercice à cet objectif.');
      }

      if (progressive) {
        const steps: ProgressionStep[] = entries.map((entry) => ({
          exerciseId: entry.exerciseId,
          requirement: { conditions: [entry.condition] },
        }));
        await createGoal({ name, target: { kind: 'progressive', steps } });
      } else {
        // Objectif simple : le requirement appartient au Goal, sans étape.
        await createGoal({
          name,
          target: {
            kind: 'simple',
            exerciseId: entries[0].exerciseId,
            requirement: { conditions: [entries[0].condition] },
          },
        });
      }
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
          subtitle="évalué sur ta dernière séance"
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

        {/* Simple ou progressif : deux formes distinctes du modèle, pas deux
            réglages d'une même forme. */}
        <View className="flex-row gap-2">
          <Choice
            label="Progressif"
            hint="plusieurs étapes"
            selected={progressive}
            onPress={() => setProgressive(true)}
          />
          <Choice
            label="Simple"
            hint="un seul exercice"
            selected={!progressive}
            onPress={() => {
              setProgressive(false);
              setEntries((current) => current.slice(0, 1));
            }}
          />
        </View>

        {entries.map((entry, index) => {
          const exercise = exerciseOf(entry.exerciseId);
          const { condition } = entry;

          return (
            <Card key={`${entry.exerciseId}-${index}`} density="titled" className="gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="shrink font-bold text-[16px] text-ink dark:text-ink-dark">
                  {progressive ? `${index + 1}. ` : ''}
                  {exercise?.name ?? entry.exerciseId}
                </Text>
                <Pressable onPress={() => setEntries((c) => c.filter((_, i) => i !== index))}>
                  <Text className="text-[13px] text-danger dark:text-danger-dark">retirer</Text>
                </Pressable>
              </View>

              <View className="flex-row flex-wrap gap-2">
                {AGGREGATIONS.map(({ value, label }) => (
                  <Chip
                    key={value}
                    label={label}
                    selected={condition.aggregation === value}
                    onPress={() =>
                      update(index, {
                        aggregation: value,
                        measurementId:
                          value === 'setCount'
                            ? null
                            : (condition.measurementId ?? exercise?.measurementIds[0] ?? null),
                      })
                    }
                  />
                ))}
              </View>

              {condition.aggregation !== 'setCount' &&
                (exercise?.measurementIds.length ?? 0) > 1 && (
                  <View className="flex-row flex-wrap gap-2">
                    {exercise?.measurementIds.map((measurementId) => (
                      <Chip
                        key={measurementId}
                        label={unitOf(measurementId)}
                        selected={condition.measurementId === measurementId}
                        onPress={() => update(index, { measurementId })}
                      />
                    ))}
                  </View>
                )}

              <View className="flex-row items-end gap-3">
                <Text className="mb-4 text-[15px] text-muted dark:text-muted-dark">au moins</Text>
                <NumberField
                  unit={
                    condition.aggregation === 'setCount'
                      ? 'séries'
                      : unitOf(condition.measurementId ?? '')
                  }
                  value={condition.target}
                  onChange={(target) => update(index, { target })}
                />
              </View>

              {/* La fenêtre d'évaluation appartient à la condition (§5). */}
              <Text className="font-mono text-[12px] text-planned">
                évalué sur la dernière séance
              </Text>
            </Card>
          );
        })}

        <Button
          label={progressive ? '+ Ajouter une étape' : entries.length ? "Changer d'exercice" : "Choisir l'exercice"}
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
        title={progressive ? 'Ajouter une étape' : "Choisir l'exercice"}
        description={
          progressive ? "Chaque étape est un exercice. L'ordre définit la progression." : undefined
        }
        searchPlaceholder="Rechercher un exercice"
        actions={exercises.map((exercise) => ({
          label: exercise.name,
          onPress: () => addEntry(exercise.id),
        }))}
        onClose={() => setPicking(false)}
      />
    </SafeAreaView>
  );
}

function Choice({
  label,
  hint,
  selected,
  onPress,
}: {
  label: string;
  hint: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={
        selected
          ? 'flex-1 rounded-lg bg-primary px-4 py-3'
          : 'flex-1 rounded-lg border border-border bg-surface px-4 py-3 dark:border-border-dark dark:bg-surface-dark'
      }
    >
      <Text className={selected ? 'font-bold text-ink' : 'font-bold text-muted dark:text-muted-dark'}>
        {label}
      </Text>
      <Text className={selected ? 'text-[12px] text-ink' : 'text-[12px] text-muted dark:text-muted-dark'}>
        {hint}
      </Text>
    </Pressable>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={
        selected
          ? 'h-10 justify-center rounded-full bg-primary px-3'
          : 'h-10 justify-center rounded-full border border-border bg-surface px-3 dark:border-border-dark dark:bg-surface-dark'
      }
    >
      <Text
        className={
          selected ? 'font-bold text-[13px] text-ink' : 'text-[13px] text-muted dark:text-muted-dark'
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}
