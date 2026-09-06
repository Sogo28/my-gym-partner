import { Ionicons } from '@expo/vector-icons';
import { messageOf } from '../src/ui/message';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Exercise } from '../src/domain/exercise/exercise';
import type { Measurement } from '../src/domain/exercise/measurement';
import { findAll, findAllMeasurements } from '../src/infra/exercise-repository';
import { Button } from '../src/ui/button';
import { BusinessNotice } from '../src/ui/notice';
import { BackHeader } from '../src/ui/screen-header';
import { createExercise } from '../src/use-cases/create-exercise';
import {
  discardExercise,
  unarchiveExercise,
  updateExercise,
} from '../src/use-cases/edit-catalogue';

/**
 * Création ET édition d'un exercice : un identifiant dans l'URL fait passer
 * l'écran en mode édition. Le formulaire est le même, il n'y a pas de raison
 * de l'écrire deux fois.
 */
export default function NewExerciseScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [existing, setExisting] = useState<Exercise | null>(null);
  const [name, setName] = useState('');
  const [isUnilateral, setIsUnilateral] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    findAllMeasurements().then(setMeasurements).catch((e) => setError(messageOf(e)));
    if (!id) return;

    findAll()
      .then((all) => {
        const exercise = all.find((candidate) => candidate.id === id);
        if (!exercise) return;
        setExisting(exercise);
        setName(exercise.name);
        setIsUnilateral(exercise.isUnilateral);
        setSelected([...exercise.measurementIds]);
      })
      .catch((e) => setError(messageOf(e)));
  }, [id]);

  async function submit() {
    try {
      // Aucune validation ici : les règles appartiennent au domaine.
      if (existing) {
        await updateExercise({ exercise: existing, name, measurementIds: selected });
      } else {
        await createExercise({ name, isUnilateral, measurementIds: selected });
      }
      router.back();
    } catch (e) {
      setError(messageOf(e));
    }
  }

  /** Archivé s'il a déjà servi, supprimé sinon : c'est la base qui tranche. */
  async function discard() {
    if (!existing) return;
    try {
      await discardExercise(existing);
      router.back();
    } catch (e) {
      setError(messageOf(e));
    }
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-5 pt-4">
        <BackHeader
          title={existing ? "Modifier l'exercice" : 'Nouvel exercice'}
          subtitle={existing ? 'les séances passées ne changent pas' : undefined}
          onBack={() => router.back()}
        />
      </View>

      <ScrollView contentContainerClassName="gap-6 px-5 pb-8">
        <View className="gap-2">
          <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">Nom</Text>
          <TextInput
            className="h-14 rounded-lg border-[1.5px] border-border bg-surface px-4 text-[17px] text-ink dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
            placeholder="Weighted pull-ups"
            placeholderTextColor="#A8AD9E"
            value={name}
            onChangeText={setName}
          />
        </View>

        <View className="gap-2">
          <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
            Mesures
          </Text>
          <Text className="text-[13px] text-muted dark:text-muted-dark">
            Comment la performance de cet exercice se mesure. Plusieurs choix possibles.
          </Text>
          <View className="mt-1 flex-row flex-wrap gap-2">
            {measurements.map((measurement) => {
              const on = selected.includes(measurement.id);
              return (
                <Pressable
                  key={measurement.id}
                  onPress={() =>
                    setSelected((current) =>
                      current.includes(measurement.id)
                        ? current.filter((id) => id !== measurement.id)
                        : [...current, measurement.id],
                    )
                  }
                  className={
                    on
                      ? 'h-12 flex-row items-center gap-2 rounded-full bg-primary px-4'
                      : 'h-12 flex-row items-center gap-2 rounded-full border border-border bg-surface px-4 dark:border-border-dark dark:bg-surface-dark'
                  }
                >
                  {on && <Ionicons name="checkmark" size={16} color="#14160F" />}
                  <Text
                    className={
                      on
                        ? 'font-bold text-ink'
                        : 'font-medium text-muted dark:text-muted-dark'
                    }
                  >
                    {measurement.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="flex-row items-center justify-between gap-4">
          <View className="shrink">
            <Text className="font-bold text-[16px] text-ink dark:text-ink-dark">
              Exercice unilatéral
            </Text>
            <Text className="text-[13px] text-muted dark:text-muted-dark">
              Saisie côté gauche / côté droit.
            </Text>
          </View>
          <Switch
            value={isUnilateral}
            // Le caractère unilatéral n'est pas modifiable : il changerait le
            // sens des performances déjà enregistrées.
            disabled={existing !== null}
            onValueChange={setIsUnilateral}
            trackColor={{ true: '#BFF04A', false: '#C3C8B8' }}
            thumbColor="#FFFFFF"
          />
        </View>

        {error && <BusinessNotice message={error} />}
      </ScrollView>

      <View className="gap-2 p-5 pt-2">
        <Button
          label={existing ? 'Enregistrer' : "Créer l'exercice"}
          size="lg"
          onPress={submit}
        />
        {existing?.isArchived ? (
          <Button
            label="Remettre au catalogue"
            variant="secondary"
            size="md"
            onPress={() =>
              unarchiveExercise(existing)
                .then(() => router.back())
                .catch((e) => setError(messageOf(e)))
            }
          />
        ) : existing ? (
          <Button label="Retirer du catalogue" variant="danger" size="md" onPress={discard} />
        ) : (
          <Button label="Annuler" variant="ghost" size="md" onPress={() => router.back()} />
        )}
      </View>
    </SafeAreaView>
  );
}
