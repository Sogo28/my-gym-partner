import { useFocusEffect, useRouter } from 'expo-router';
import {
  AGGREGATION_LABELS,
  describeDemand,
  describeSource,
  describeSourceShort,
  targetUnit,
  WINDOW_LABELS,
} from '../src/ui/goal-labels';
import { useNotifications } from '../src/ui/notifications';
import { messageOf } from '../src/ui/message';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Exercise } from '../src/domain/exercise/exercise';
import type { Measurement } from '../src/domain/exercise/measurement';
import type { Muscle } from '../src/domain/exercise/muscle';
import type { BodyMetric } from '../src/domain/body/body-metric';
import type { Clause, Condition, GoalSubject, ProgressionStep } from '../src/domain/goal/goal';
import { windowsFor } from '../src/domain/goal/goal';
import { findAllMeasurements, findAllMuscles } from '../src/infra/exercise-repository';
import { findRecentExerciseIds } from '../src/infra/performance-repository';
import { listActiveExercises } from '../src/use-cases/edit-catalogue';
import { listMetrics } from '../src/use-cases/body-actions';
import { Button } from '../src/ui/button';
import { Card } from '../src/ui/card';
import { NumberField } from '../src/ui/number-field';
import { ExercisePicker } from '../src/ui/exercise-picker';
import { catalogueSource } from '../src/use-cases/repdb-actions';
import { takeCreated } from '../src/ui/created-exercise';
import { BackHeader } from '../src/ui/screen-header';
import { Sheet } from '../src/ui/sheet';
import { createGoal } from '../src/use-cases/goal-actions';

/** Une entrée de l'écran : ce qui est visé, et ses conditions. */
type Entry = { subject: GoalSubject; conditions: Condition[] };

/**
 * La condition de départ dépend du sujet : une mensuration s'observe au
 * dernier relevé, un exercice sur sa dernière séance.
 *
 * Dès que l'exercice a PLUSIEURS mesures, elles vont de paire : 10 reps À
 * 60 kg décrit une série, pas deux exigences. La condition compte alors les
 * séries qui répondent à cette description -- moyenner chaque mesure de son
 * côté validerait 15×40 puis 5×80, qu'aucune de ces deux séries ne vaut.
 */
function defaultCondition(subject: GoalSubject, measurementIds: readonly string[]): Condition {
  const isBody = subject.kind === 'body';

  if (!isBody && measurementIds.length > 1) {
    return {
      measurementId: null,
      window: 'LAST_SESSION',
      aggregation: 'setCount',
      operator: '>=',
      target: 1,
      qualifying: measurementIds.map((measurementId) => ({
        measurementId,
        operator: '>=' as const,
        target: 10,
      })),
    };
  }

  return {
    measurementId: measurementIds[0],
    window: isBody ? 'LATEST_READING' : 'LAST_SESSION',
    aggregation: isBody ? 'max' : 'average',
    operator: '>=',
    target: 10,
  };
}

export default function NewGoalScreen() {
  const { notify } = useNotifications();
  const router = useRouter();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [muscles, setMuscles] = useState<Muscle[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  /** Ce que le sélecteur propose : des exercices, ou des mensurations. */
  const [picking, setPicking] = useState<'none' | 'exercise' | 'body'>('none');
  /**
   * L'exercice qu'on vient de créer, en attente d'être ajouté.
   *
   * Il ne peut pas l'être tout de suite : on revient du formulaire avant que
   * la liste rechargée ne le connaisse, et une étape se construit à partir
   * des MESURES de son exercice. Il patiente donc ici le temps du chargement.
   */
  const [justCreated, setJustCreated] = useState<string | null>(null);
  /**
   * L'étape qu'on est en train de régler, ou aucune.
   *
   * Une seule à la fois : les autres se replient sur ce qu'elles demandent.
   * Déplier cinq étapes à la fois donnait une page de réglages où l'objectif
   * lui-même devenait invisible.
   */
  const [open, setOpen] = useState<number | null>(null);
  /** Les réglages fins de l'étape ouverte : période, agrégation, ET. */
  const [refining, setRefining] = useState(false);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [name, setName] = useState('');
  const [progressive, setProgressive] = useState(true);
  const [entries, setEntries] = useState<Entry[]>([]);

  // À chaque affichage, et non au seul montage : un exercice ou une
  // mensuration créés entre-temps doivent apparaître ici.
  useFocusEffect(
    useCallback(() => {
      Promise.all([
        listActiveExercises(),
        findAllMeasurements(),
        listMetrics(),
        findAllMuscles(),
        findRecentExerciseIds(),
      ])
        .then(([all, allMeasurements, allMetrics, allMuscles, recent]) => {
          setExercises(all);
          setMeasurements(allMeasurements);
          setMetrics(allMetrics);
          setMuscles(allMuscles);
          setRecentIds(recent);
        })
        .catch((e) => notify(messageOf(e)));

      // Créer un exercice depuis le sélecteur, c'était le choisir : revenir
      // ne doit pas laisser ce geste inachevé.
      const created = takeCreated();
      if (created) setJustCreated(created);
    }, []),
  );

  /**
   * L'ajout attend que la liste ait rattrapé son retard.
   *
   * Séparé de l'effet de focus, qui est figé à sa création : ici les valeurs
   * sont celles du rendu courant -- notamment le fait que l'objectif soit
   * progressif ou non, qui décide si l'exercice s'ajoute ou remplace.
   */
  useEffect(() => {
    if (justCreated === null) return;
    const exercise = exercises.find((candidate) => candidate.id === justCreated);
    if (!exercise) return;

    setJustCreated(null);
    addExerciseEntry(exercise);
  }, [justCreated, exercises]);

  const catalogue = useMemo(
    () =>
      catalogueSource(() => {
        listActiveExercises().then(setExercises).catch((e) => notify(messageOf(e)));
      }),
    [],
  );

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

  /**
   * Ajouter un exercice à partir de l'exercice LUI-MÊME, sans le rechercher
   * dans la liste en état : celui qui vient d'être créé n'y est pas encore.
   */
  function addExerciseEntry(exercise: Exercise) {
    add([
      {
        subject: { kind: 'exercise', exerciseId: exercise.id },
        measurementIds: exercise.measurementIds,
      },
    ]);
  }

  function addEntry(subject: GoalSubject) {
    add([{ subject, measurementIds: measurementsOf(subject) }]);
  }

  /**
   * Ajouter d'un coup, et ouvrir la dernière.
   *
   * D'un coup parce que le sélecteur en rend plusieurs : ajoutées une par
   * une, chacune calculerait sa position sur une liste qui n'a pas encore
   * changé. Et ouverte, parce qu'une étape qu'on vient de désigner est
   * précisément celle qu'on veut régler.
   */
  function add(wanted: { subject: GoalSubject; measurementIds: readonly string[] }[]) {
    const built = wanted
      .filter((entry) => entry.measurementIds.length > 0)
      .map(({ subject, measurementIds }) => ({
        subject,
        conditions: [defaultCondition(subject, measurementIds)],
      }));
    if (built.length === 0) return;

    // Un objectif simple ne vise qu'une chose : le nouveau remplace l'ancien.
    setEntries((current) => (progressive ? [...current, ...built] : built.slice(-1)));
    setOpen(progressive ? entries.length + built.length - 1 : 0);
    setRefining(false);
  }

  /** Retirer une étape : ce qui était ouvert se décale, ou se referme. */
  function removeEntry(index: number) {
    setEntries((current) => current.filter((_, i) => i !== index));
    setOpen((current) =>
      current === null || current === index ? null : current > index ? current - 1 : current,
    );
  }

  /** Ouvrir une étape en referme l'autre, et repart de ses réglages simples. */
  function toggle(index: number) {
    setRefining(false);
    setOpen((current) => (current === index ? null : index));
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

  /** La cible d'une mesure DANS la série décrite : les autres ne bougent pas. */
  function updateClause(
    index: number,
    conditionIndex: number,
    measurementId: string,
    target: number,
  ) {
    const condition = entries[index].conditions[conditionIndex];
    const qualifying: Clause[] = (condition.qualifying ?? []).map((clause) =>
      clause.measurementId === measurementId ? { ...clause, target } : clause,
    );
    update(index, conditionIndex, { qualifying });
  }

  /** Toutes les conditions d'un requirement doivent tenir : c'est un ET. */
  function addCondition(index: number) {
    const entry = entries[index];
    const available = measurementsOf(entry.subject);
    if (available.length === 0) return;
    setEntries((current) =>
      current.map((item, i) =>
        i === index
          ? {
              ...item,
              conditions: [...item.conditions, defaultCondition(item.subject, available)],
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
      notify(messageOf(e));
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background pb-3 dark:bg-background-dark">
      <View className="px-5 pt-4">
        <BackHeader
          title="Nouvel objectif"
          subtitle="chaque condition choisit sa période"
          onBack={() => router.back()}
        />
      </View>

      <ScrollView contentContainerClassName="gap-4 px-5 pb-8" keyboardShouldPersistTaps="handled">
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
              // Un objectif simple ne vise qu'une chose : les étapes au-delà
              // de la première n'ont plus lieu d'être, et celle qui reste est
              // évidemment celle qu'on règle.
              setEntries((current) => current.slice(0, 1));
              setOpen((current) => (current === null ? null : 0));
              setRefining(false);
            }}
          />
        </View>

        {entries.map((entry, index) => {
          const available = measurementsOf(entry.subject);
          const windows = windowsFor(entry.subject);
          // Un relevé est une valeur unique : il n'y a ni période ni
          // agrégation à choisir, seulement une cible à atteindre.
          const isReading = entry.subject.kind === 'body';
          // Plusieurs mesures ne se règlent pas séparément : elles décrivent
          // ensemble la série qui compte.
          const paired = !isReading && available.length > 1;
          const first = entry.conditions[0];

          // Repliée, l'étape dit ce qu'elle demande et ce que ça signifie :
          // de quoi la relire sans la rouvrir.
          if (open !== index) {
            return (
              <Pressable key={index} onPress={() => toggle(index)}>
                <Card className="flex-row items-center justify-between gap-3">
                  <View className="shrink gap-0.5">
                    <Text
                      className="font-bold text-[15px] text-ink dark:text-ink-dark"
                      numberOfLines={1}
                    >
                      {progressive ? `${index + 1}. ` : ''}
                      {subjectName(entry.subject)}
                    </Text>
                    <Text className="text-[11px] text-muted dark:text-muted-dark">
                      {describeSourceShort(first)}
                    </Text>
                  </View>
                  <Text
                    className="font-mono-bold text-[13px] text-primary-ink dark:text-primary-ink-dark"
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    {describeDemand([{ conditions: entry.conditions }], unitOf)}
                  </Text>
                </Card>
              </Pressable>
            );
          }

          return (
            <Card key={index} density="titled" className="gap-3">
              <View className="flex-row items-center justify-between">
                <Pressable className="shrink" onPress={() => toggle(index)}>
                  <Text className="font-bold text-[16px] text-ink dark:text-ink-dark">
                    {progressive ? `${index + 1}. ` : ''}
                    {subjectName(entry.subject)}
                  </Text>
                </Pressable>
                <Pressable onPress={() => removeEntry(index)}>
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

                  {/* La série décrite d'un bloc : une cible par mesure, lues
                      TOUJOURS sur la même série. Elle reste en vue, car c'est
                      elle que l'on vient régler. */}
                  {paired && (
                    <View className="gap-2">
                      <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
                        Une série qui compte
                      </Text>
                      <View className="flex-row flex-wrap gap-3">
                        {(condition.qualifying ?? []).map((clause) => (
                          <NumberField
                            key={clause.measurementId}
                            unit={unitOf(clause.measurementId)}
                            value={clause.target}
                            onChange={(target) =>
                              updateClause(index, conditionIndex, clause.measurementId, target)
                            }
                          />
                        ))}
                      </View>
                    </View>
                  )}

                  <View className="flex-row items-end gap-3">
                    <Text className="mb-4 text-[15px] text-muted dark:text-muted-dark">
                      au moins
                    </Text>
                    <NumberField
                      unit={targetUnit(condition, unitOf)}
                      value={condition.target}
                      onChange={(target) => update(index, conditionIndex, { target })}
                    />
                  </View>

                  {/* Comment la mesure est réduite, et sur quelle période :
                      les valeurs de départ disent déjà ce que veut dire la
                      plupart des objectifs, donc elles attendent qu'on les
                      demande. */}
                  {refining && !isReading && !paired && (
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

                  {/* Les périodes que ce sujet sait alimenter : une
                      mensuration n'en a qu'une, donc rien à choisir. */}
                  {refining && windows.length > 1 && (
                    <View className="flex-row flex-wrap gap-2">
                      {WINDOW_LABELS.filter((entry) => windows.includes(entry.value)).map(
                        ({ value, label }) => (
                          <Chip
                            key={value}
                            label={label}
                            selected={condition.window === value}
                            onPress={() => update(index, conditionIndex, { window: value })}
                          />
                        ),
                      )}
                    </View>
                  )}

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

              {/* Tout reste atteignable : c'est l'ordre d'apparition qui
                  change, pas ce qu'on peut exprimer. */}
              <Pressable onPress={() => setRefining((on) => !on)}>
                <Text className="font-bold text-[13px] text-primary-ink dark:text-primary-ink-dark">
                  {refining ? 'Replier les réglages ⌃' : 'Affiner ⌄'}
                </Text>
              </Pressable>

              {refining && (
                <Button
                  label="+ Ajouter une condition"
                  variant="ghost"
                  size="md"
                  onPress={() => addCondition(index)}
                />
              )}
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
      </ScrollView>

      <View className="p-5 pt-2">
        <Button
          label="Créer l'objectif"
          size="lg"
          // Le domaine refuse déjà un objectif sans nom, mais un refus arrive
          // APRÈS le geste : l'écran, lui, sait avant. Un objectif sans nom ni
          // rien à viser n'est pas quelque chose qu'on crée à moitié.
          disabled={name.trim() === '' || entries.length === 0}
          onPress={submit}
        />
      </View>

      {/* Une progression se choisit d'un bloc : les étapes suivent l'ordre
          dans lequel on coche les exercices. Un objectif simple n'en vise
          qu'un, et se referme dès qu'on l'a touché. */}
      <ExercisePicker
        catalogue={catalogue}
        onCreate={(name) =>
          router.push({ pathname: '/new-exercise', params: { name, announce: '1' } })
        }
        onOpenSettings={() => {
          setPicking('none');
          router.push('/settings');
        }}
        visible={picking === 'exercise'}
        mode={progressive ? 'multiple' : 'single'}
        title={progressive ? 'Ajouter des étapes' : "Choisir l'exercice"}
        exercises={exercises}
        muscles={muscles}
        recentIds={recentIds}
        onConfirm={(ids) => {
          for (const exerciseId of ids) addEntry({ kind: 'exercise', exerciseId });
        }}
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
