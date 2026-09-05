import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Measurement } from '../src/domain/exercise/measurement';
import { findAllMeasurements } from '../src/infra/exercise-repository';
import { Button } from '../src/ui/button';
import { BusinessNotice } from '../src/ui/notice';
import { BackHeader } from '../src/ui/screen-header';
import { createExercise } from '../src/use-cases/create-exercise';

export default function NewExerciseScreen() {
  const router = useRouter();
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [name, setName] = useState('');
  const [isUnilateral, setIsUnilateral] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    findAllMeasurements().then(setMeasurements).catch((e) => setError(String(e)));
  }, []);

  async function submit() {
    try {
      // Aucune validation ici : les règles appartiennent au domaine.
      await createExercise({ name, isUnilateral, measurementIds: selected });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-5 pt-4">
        <BackHeader title="Nouvel exercice" onBack={() => router.back()} />
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
            onValueChange={setIsUnilateral}
            trackColor={{ true: '#BFF04A', false: '#C3C8B8' }}
            thumbColor="#FFFFFF"
          />
        </View>

        {error && <BusinessNotice message={error} />}
      </ScrollView>

      <View className="gap-2 p-5 pt-2">
        <Button label="Créer l'exercice" size="lg" onPress={submit} />
        <Button label="Annuler" variant="ghost" size="md" onPress={() => router.back()} />
      </View>
    </SafeAreaView>
  );
}
