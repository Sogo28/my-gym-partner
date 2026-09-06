import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Exercise } from '../src/domain/exercise/exercise';
import type { Measurement } from '../src/domain/exercise/measurement';
import type {
  Aggregation,
  Condition,
  EvaluationWindow,
  ProgressionStep,
} from '../src/domain/goal/goal';
import { findAllMeasurements } from '../src/infra/exercise-repository';
import { listActiveExercises } from '../src/use-cases/edit-catalogue';
import { Button } from '../src/ui/button';
import { Card } from '../src/ui/card';
import { NumberField } from '../src/ui/number-field';
import { BusinessNotice } from '../src/ui/notice';
import { BackHeader } from '../src/ui/screen-header';
import { Sheet } from '../src/ui/sheet';
import { createGoal } from '../src/use-cases/goal-actions';

/** Ce que chaque agrégation calcule sur les séries de la période observée. */
const AGGREGATIONS: { value: Aggregation; label: string }[] = [
  { value: 'average', label: 'Moyenne' },
  { value: 'max', label: 'Meilleure série' },
  { value: 'min', label: 'Plus faible série' },
  { value: 'total', label: 'Cumul' },
  { value: 'setCount', label: 'Nombre de séries' },
];

const AGGREGATION_PHRASES: Record<Aggregation, string> = {
  average: 'moyenne des valeurs',
  max: 'meilleure valeur',
  min: 'plus faible valeur',
  total: 'somme des valeurs',
  setCount: 'nombre de séries complétées',
};

/**
 * La période observée. Elle appartient à CHAQUE condition : une même exigence
 * peut demander une forme du jour et un volume accumulé.
 */
const WINDOWS: { value: EvaluationWindow; label: string; phrase: string }[] = [
  { value: 'LAST_SESSION', label: 'Dernière séance', phrase: 'lors de la dernière séance' },
  { value: 'ALL_TIME', label: 'Tout l historique', phrase: 'sur tout l historique' },
];

function describeCondition(condition: Condition): string {
  const window = WINDOWS.find((entry) => entry.value === condition.window);
  return `${AGGREGATION_PHRASES[condition.aggregation]} ${window?.phrase ?? ''}`;
}

/** Une entrée de l'écran : un exercice et sa condition. */
type Entry = { exerciseId: string; conditions: Condition[] };

function defaultCondition(measurementId: string): Condition {
  return {
    measurementId,
    window: 'LAST_SESSION',
    aggregation: 'average',
    operator: '>=',
    target: 10,
  };
}

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
    Promise.all([listActiveExercises(), findAllMeasurements()])
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

    const entry: Entry = { exerciseId, conditions: [defaultCondition(measurementId)] };
    // Un objectif simple ne vise qu'un exercice : le nouveau remplace l'ancien.
    setEntries((current) => (progressive ? [...current, entry] : [entry]));
  }

  function update(index: number, conditionIndex: number, changes: Partial<Condition>) {
    setEntries((current) =>
      current.map((entry, i) =>
        i === index
          ? {
              ...entry,
              conditions: entry.conditions.map((condition, c) =>
                c === conditionIndex ? { ...condition, ...changes } : condition,
              ),
            }
          : entry,
      ),
    );
  }

  /** Toutes les conditions d'un requirement doivent tenir : c'est un ET. */
  function addCondition(index: number) {
    const measurementId = exerciseOf(entries[index].exerciseId)?.measurementIds[0];
    if (!measurementId) return;
    setEntries((current) =>
      current.map((entry, i) =>
        i === index
          ? { ...entry, conditions: [...entry.conditions, defaultCondition(measurementId)] }
          : entry,
      ),
    );
  }

  function removeCondition(index: number, conditionIndex: number) {
    setEntries((current) =>
      current.map((entry, i) =>
        i === index
          ? { ...entry, conditions: entry.conditions.filter((_, c) => c !== conditionIndex) }
          : entry,
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
          requirements: [{ conditions: entry.conditions }],
        }));
        await createGoal({ name, target: { kind: 'progressive', steps } });
      } else {
        // Objectif simple : le requirement appartient au Goal, sans étape.
        await createGoal({
          name,
          target: {
            kind: 'simple',
            exerciseId: entries[0].exerciseId,
            requirements: [{ conditions: entries[0].conditions }],
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
          subtitle="chaque condition choisit sa période"
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

              {entry.conditions.map((condition, conditionIndex) => (
                <View
                  key={conditionIndex}
                  className="gap-3 rounded-lg bg-surface-alt p-3 dark:bg-surface-alt-dark"
                >
                  {conditionIndex > 0 && (
                    <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
                      et
                    </Text>
                  )}

                  <View className="flex-row flex-wrap gap-2">
                    {AGGREGATIONS.map(({ value, label }) => (
                      <Chip
                        key={value}
                        label={label}
                        selected={condition.aggregation === value}
                        onPress={() =>
                          update(index, conditionIndex, {
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
                            onPress={() => update(index, conditionIndex, { measurementId })}
                          />
                        ))}
                      </View>
                    )}

                  <View className="flex-row items-end gap-3">
                    <Text className="mb-4 text-[15px] text-muted dark:text-muted-dark">
                      au moins
                    </Text>
                    <NumberField
                      unit={
                        condition.aggregation === 'setCount'
                          ? 'séries'
                          : unitOf(condition.measurementId ?? '')
                      }
                      value={condition.target}
                      onChange={(target) => update(index, conditionIndex, { target })}
                    />
                  </View>

                  {/* La période observée : elle change le sens de la condition. */}
                  <View className="flex-row flex-wrap gap-2">
                    {WINDOWS.map(({ value, label }) => (
                      <Chip
                        key={value}
                        label={label}
                        selected={condition.window === value}
                        onPress={() => update(index, conditionIndex, { window: value })}
                      />
                    ))}
                  </View>

                  {/* La phrase exacte que cette condition signifie. */}
                  <View className="flex-row items-center justify-between gap-3">
                    <Text className="shrink font-mono text-[12px] text-planned">
                      {describeCondition(condition)}
                    </Text>
                    {entry.conditions.length > 1 && (
                      <Pressable onPress={() => removeCondition(index, conditionIndex)}>
                        <Text className="text-[12px] text-danger dark:text-danger-dark">
                          retirer
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              ))}

              <Button
                label="+ Ajouter une condition"
                variant="ghost"
                size="md"
                onPress={() => addCondition(index)}
              />
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
