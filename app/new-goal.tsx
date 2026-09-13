import { useFocusEffect, useRouter } from 'expo-router';
import {
  AGGREGATION_LABELS,
  conditionParts,
  targetUnit,
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
import type {
  Clause,
  Condition,
  GoalSubject,
  ProgressionStep,
} from '../src/domain/goal/goal';
import { findAllMeasurements, findAllMuscles } from '../src/infra/exercise-repository';
import { findRecentExerciseIds } from '../src/infra/performance-repository';
import { listActiveExercises } from '../src/use-cases/edit-catalogue';
import { listMetrics } from '../src/use-cases/body-actions';
import { Button } from '../src/ui/button';
import { Card } from '../src/ui/card';
import { MeasureField } from '../src/ui/measure-field';
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
   * La condition qu'on règle, ou aucune.
   *
   * Les réglages vivent dans une feuille et non dans la page : une condition
   * se LIT bien plus souvent qu'elle ne se change, et la page doit donc
   * montrer l'objectif qu'on construit, pas la mécanique qui le décrit.
   */
  const [editing, setEditing] = useState<{ entry: number; condition: number } | null>(null);
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
  }

  function removeEntry(index: number) {
    setEntries((current) => current.filter((_, i) => i !== index));
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

  /** Ce que la feuille de réglage manipule, s'il y a lieu. */
  const edited = editing ? entries[editing.entry] : undefined;
  const editedCondition = editing ? edited?.conditions[editing.condition] : undefined;

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
          className="h-14 rounded-lg border-2 border-border bg-surface px-4 text-strong text-ink dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
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
            onPress={() => {
              setProgressive(true);
              // Une mensuration retenue en mode simple n'est pas une marche :
              // la garder ferait une progression que l'écran ne sait pas
              // décrire.
              setEntries((current) =>
                current.filter((entry) => entry.subject.kind === 'exercise'),
              );
            }}
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
            }}
          />
        </View>

        {entries.map((entry, index) => {
          const isReading = entry.subject.kind === 'body';

          return (
            <Card key={index} density="titled" className="gap-1">
              <View className="flex-row items-center justify-between pb-1">
                <Text
                  className="shrink font-bold text-body text-ink dark:text-ink-dark"
                  numberOfLines={1}
                >
                  {progressive ? `${index + 1}. ` : ''}
                  {subjectName(entry.subject)}
                </Text>
                <Pressable onPress={() => removeEntry(index)} hitSlop={8}>
                  <Text className="text-caption text-danger dark:text-danger-dark">retirer</Text>
                </Pressable>
              </View>

              {/* Une condition se LIT ; on ne la règle qu'en la touchant. La
                  phrase à gauche, le chiffre à droite : c'est le chiffre
                  qu'on cherche du regard en relisant une étape. */}
              {entry.conditions.map((condition, conditionIndex) => {
                const { what, target } = conditionParts(condition, unitOf);

                return (
                  <Pressable
                    key={conditionIndex}
                    onPress={() => setEditing({ entry: index, condition: conditionIndex })}
                    className="flex-row items-baseline justify-between gap-3 border-b border-border py-2.5 dark:border-border-dark"
                  >
                    <Text className="shrink text-small text-muted dark:text-muted-dark">
                      {conditionIndex > 0 ? 'et ' : ''}
                      {what}
                    </Text>
                    <Text
                      className="font-mono-bold text-lead text-ink dark:text-ink-dark"
                      style={{ fontVariant: ['tabular-nums'] }}
                    >
                      {target}
                    </Text>
                  </Pressable>
                );
              })}

              {!isReading && (
                <Pressable onPress={() => addCondition(index)} className="py-2">
                  <Text className="text-body text-primary-ink dark:text-primary-ink-dark">
                    + Ajouter une condition
                  </Text>
                </Pressable>
              )}
            </Card>
          );
        })}



        {/* Une progression est une suite d'EXERCICES : on grimpe du tuck au
            full, alors qu'un tour de cuisse n'a pas de marches. Le modèle
            l'autorise -- il décrit ce qui est exprimable -- mais l'écran ne
            le propose pas, faute d'un cas où cela voudrait dire quelque
            chose.

            Un texte, pas un bouton : ajouter est un geste parmi d'autres sur
            cette page, pas ce qu'elle demande. */}
        {progressive ? (
          <Pressable onPress={() => setPicking('exercise')} className="py-2">
            <Text className="text-center text-lead text-primary-ink dark:text-primary-ink-dark">
              + Ajouter un exercice
            </Text>
          </Pressable>
        ) : (
          // Un objectif simple ne vise qu'UNE chose : une fois choisie, les
          // deux boutons ne proposaient plus d'ajouter mais de remplacer, ce
          // qu'ils ne disaient pas. On en change en retirant ce qu'on a.
          entries.length === 0 && (
            <View className="flex-row gap-2">
              <Button
                label="Un exercice"
                variant="secondary"
                size="md"
                className="flex-1"
                onPress={() => setPicking('exercise')}
              />
              <Button
                label="Une mensuration"
                variant="secondary"
                size="md"
                className="flex-1"
                onPress={() => setPicking('body')}
              />
            </View>
          )
        )}
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

      {/* Une seule feuille pour toutes les conditions : celle qu'on règle
          dit ce qu'elle montre. Le titre nomme l'étape, sans quoi on ne
          saurait plus laquelle on est venu changer. */}
      <Sheet
        visible={editing !== null}
        title={edited ? subjectName(edited.subject) : ''}
        onClose={() => setEditing(null)}
      >
        {editing && editedCondition && (
          <View className="gap-4">
            {/* La série décrite d'un bloc : une cible par mesure, lues
                TOUJOURS sur la même série. */}
            {(editedCondition.qualifying ?? []).length > 0 && (
              <View className="gap-2">
                <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
                  Une série qui compte
                </Text>
                <View className="flex-row flex-wrap gap-3">
                  {(editedCondition.qualifying ?? []).map((clause) => (
                    <MeasureField
                      key={clause.measurementId}
                      compact
                      unit={unitOf(clause.measurementId)}
                      value={clause.target}
                      onChange={(target) =>
                        updateClause(editing.entry, editing.condition, clause.measurementId, target)
                      }
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Ce qui est calculé. Un relevé n'a rien à réduire, et une série
                décrite non plus : elle se compte, un point c'est tout. */}
            {edited?.subject.kind === 'exercise' &&
              (editedCondition.qualifying ?? []).length === 0 && (
                <View className="gap-2">
                  <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
                    Ce qui est calculé
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {AGGREGATION_LABELS.map(({ value, label }) => (
                      <Chip
                        key={value}
                        label={label}
                        selected={editedCondition.aggregation === value}
                        onPress={() =>
                          update(editing.entry, editing.condition, {
                            aggregation: value,
                            // Un décompte ne lit aucune mesure ; les autres en
                            // exigent une, et reprennent celle de l'exercice.
                            measurementId:
                              value === 'setCount'
                                ? null
                                : (editedCondition.measurementId ??
                                  measurementsOf(edited.subject)[0] ??
                                  null),
                          })
                        }
                      />
                    ))}
                  </View>
                </View>
              )}

            <View className="flex-row items-end gap-3">
              <Text className="mb-2 text-lead text-muted dark:text-muted-dark">au moins</Text>
              <MeasureField
                compact
                unit={targetUnit(editedCondition, unitOf)}
                value={editedCondition.target}
                onChange={(target) => update(editing.entry, editing.condition, { target })}
              />
            </View>

            {/* Une exigence sans condition ne s'évaluerait plus : la dernière
                ne se retire pas, c'est l'étape entière qui part alors. */}
            {edited && edited.conditions.length > 1 && (
              <Pressable
                onPress={() => {
                  removeCondition(editing.entry, editing.condition);
                  setEditing(null);
                }}
                className="min-h-touch items-center justify-center rounded-lg border border-[#EAB9B5] bg-[#FDF1F0] dark:border-[#5C332B] dark:bg-[#2A1A16]"
              >
                <Text className="font-bold text-lead text-danger dark:text-danger-dark">
                  Retirer cette condition
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </Sheet>

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
      <Text className={selected ? 'text-small text-ink' : 'text-small text-muted dark:text-muted-dark'}>
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
          selected ? 'font-bold text-small text-ink' : 'text-small text-muted dark:text-muted-dark'
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}
