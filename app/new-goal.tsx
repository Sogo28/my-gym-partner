import { useRouter } from 'expo-router';
import {
  AGGREGATION_LABELS,
  describeSource,
  WINDOW_LABELS,
} from '../src/ui/goal-labels';
import { messageOf } from '../src/ui/message';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Exercise } from '../src/domain/exercise/exercise';
import type { Measurement } from '../src/domain/exercise/measurement';
import type { BodyMetric } from '../src/domain/body/body-metric';
import type { Condition, GoalSubject, ProgressionStep } from '../src/domain/goal/goal';
import { windowsFor } from '../src/domain/goal/goal';
import { findAllMeasurements } from '../src/infra/exercise-repository';
import { listActiveExercises } from '../src/use-cases/edit-catalogue';
import { listMetrics } from '../src/use-cases/body-actions';
import { Button } from '../src/ui/button';
import { Card } from '../src/ui/card';
import { NumberField } from '../src/ui/number-field';
import { BusinessNotice } from '../src/ui/notice';
import { BackHeader } from '../src/ui/screen-header';
import { Sheet } from '../src/ui/sheet';
import { createGoal } from '../src/use-cases/goal-actions';

/** Une entrée de l'écran : ce qui est visé, et ses conditions. */
type Entry = { subject: GoalSubject; conditions: Condition[] };

/**
 * La condition de départ dépend du sujet : une mensuration s'observe au
 * dernier relevé, un exercice sur sa dernière séance.
 */
function defaultCondition(subject: GoalSubject, measurementId: string): Condition {
  const isBody = subject.kind === 'body';
  return {
    measurementId,
    window: isBody ? 'LATEST_READING' : 'LAST_SESSION',
    aggregation: isBody ? 'max' : 'average',
    operator: '>=',
    target: 10,
  };
}

export default function NewGoalScreen() {
  const router = useRouter();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  /** Ce que le sélecteur propose : des exercices, ou des mensurations. */
  const [picking, setPicking] = useState<'none' | 'exercise' | 'body'>('none');
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [name, setName] = useState('');
  const [progressive, setProgressive] = useState(true);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listActiveExercises(), findAllMeasurements(), listMetrics()])
      .then(([all, allMeasurements, allMetrics]) => {
        setExercises(all);
        setMeasurements(allMeasurements);
        setMetrics(allMetrics);
      })
      .catch((e) => setError(messageOf(e)));
  }, []);

  const exerciseOf = (id: string) => exercises.find((e) => e.id === id);
  const metricOf = (id: string) => metrics.find((m) => m.id === id);
  const unitOf = (id: string) =>
    measurements.find((m) => m.id === id)?.unit ?? metricOf(id)?.unit ?? id;

  /** Le nom de ce qui est visé, et les mesures qu'on peut y observer. */
  const subjectName = (subject: GoalSubject) =>
    subject.kind === 'exercise'
      ? (exerciseOf(subject.exerciseId)?.name ?? subject.exerciseId)
      : (metricOf(subject.metricId)?.name ?? subject.metricId);

  const measurementsOf = (subject: GoalSubject): readonly string[] =>
    subject.kind === 'exercise'
      ? (exerciseOf(subject.exerciseId)?.measurementIds ?? [])
      : // Une mensuration ne se mesure qu'elle-même : « tour de cuisse en cm ».
        [subject.metricId];

  function addEntry(subject: GoalSubject) {
    const measurementId = measurementsOf(subject)[0];
    if (!measurementId) return;

    const entry: Entry = { subject, conditions: [defaultCondition(subject, measurementId)] };
    // Un objectif simple ne vise qu'une chose : le nouveau remplace l'ancien.
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
    const entry = entries[index];
    const measurementId = measurementsOf(entry.subject)[0];
    if (!measurementId) return;
    setEntries((current) =>
      current.map((item, i) =>
        i === index
          ? {
              ...item,
              conditions: [...item.conditions, defaultCondition(item.subject, measurementId)],
            }
          : item,
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
        throw new Error('Ajoute au moins un exercice ou une mensuration à cet objectif.');
      }

      if (progressive) {
        const steps: ProgressionStep[] = entries.map((entry) => ({
          subject: entry.subject,
          requirements: [{ conditions: entry.conditions }],
        }));
        await createGoal({ name, target: { kind: 'progressive', steps } });
      } else {
        // Objectif simple : le requirement appartient au Goal, sans étape.
        await createGoal({
          name,
          target: {
            kind: 'simple',
            subject: entries[0].subject,
            requirements: [{ conditions: entries[0].conditions }],
          },
        });
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
          const available = measurementsOf(entry.subject);
          const windows = windowsFor(entry.subject);
          // Un relevé est une valeur unique : il n'y a ni période ni
          // agrégation à choisir, seulement une cible à atteindre.
          const isReading = entry.subject.kind === 'body';

          return (
            <Card key={index} density="titled" className="gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="shrink font-bold text-[16px] text-ink dark:text-ink-dark">
                  {progressive ? `${index + 1}. ` : ''}
                  {subjectName(entry.subject)}
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

                  {!isReading && (
                  <View className="flex-row flex-wrap gap-2">
                    {AGGREGATION_LABELS.map(({ value, label }) => (
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
                                : (condition.measurementId ?? available[0] ?? null),
                          })
                        }
                      />
                    ))}
                  </View>
                  )}

                  {!isReading && condition.aggregation !== 'setCount' && available.length > 1 && (
                      <View className="flex-row flex-wrap gap-2">
                        {available.map((measurementId) => (
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

                  {/* Les périodes que ce sujet sait alimenter : une
                      mensuration n'en a qu'une, donc rien à choisir. */}
                  {windows.length > 1 && (
                  <View className="flex-row flex-wrap gap-2">
                    {WINDOW_LABELS.filter((entry) => windows.includes(entry.value)).map(({ value, label }) => (
                      <Chip
                        key={value}
                        label={label}
                        selected={condition.window === value}
                        onPress={() => update(index, conditionIndex, { window: value })}
                      />
                    ))}
                  </View>
                  )}

                  {/* La phrase exacte que cette condition signifie. */}
                  <View className="flex-row items-center justify-between gap-3">
                    <Text className="shrink font-mono text-[12px] text-planned">
                      {describeSource(condition)}
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

        {/* Deux sources possibles : ce qu'on exécute, ou ce qu'on mesure. */}
        <View className="flex-row gap-2">
          <Button
            label={progressive ? '+ Exercice' : 'Un exercice'}
            variant="secondary"
            size="md"
            className="flex-1"
            onPress={() => setPicking('exercise')}
          />
          <Button
            label={progressive ? '+ Mensuration' : 'Une mensuration'}
            variant="secondary"
            size="md"
            className="flex-1"
            onPress={() => setPicking('body')}
          />
        </View>

        {error && <BusinessNotice message={error} />}
      </ScrollView>

      <View className="p-5 pt-2">
        <Button label="Créer l'objectif" size="lg" onPress={submit} />
      </View>

      <Sheet
        visible={picking === 'exercise'}
        title={progressive ? 'Ajouter un exercice' : "Choisir l'exercice"}
        description={progressive ? "L'ordre des étapes définit la progression." : undefined}
        searchPlaceholder="Rechercher un exercice"
        actions={exercises.map((exercise) => ({
          label: exercise.name,
          onPress: () => addEntry({ kind: 'exercise', exerciseId: exercise.id }),
        }))}
        onClose={() => setPicking('none')}
      />

      <Sheet
        visible={picking === 'body'}
        title="Choisir une mensuration"
        description="Évaluée sur ton dernier relevé, pas sur tes séances."
        searchPlaceholder="Rechercher une mensuration"
        actions={metrics.map((metric) => ({
          label: `${metric.name} (${metric.unit})`,
          onPress: () => addEntry({ kind: 'body', metricId: metric.id }),
        }))}
        onClose={() => setPicking('none')}
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
