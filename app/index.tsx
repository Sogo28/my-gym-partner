import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Exercise } from '../src/domain/exercise/exercise';
import type { Measurement } from '../src/domain/exercise/measurement';
import { findAll, findAllMeasurements } from '../src/infra/exercise-repository';
import { Button } from '../src/ui/button';
import { Card } from '../src/ui/card';
import { EmptyState } from '../src/ui/empty-state';
import { SectionHeader } from '../src/ui/screen-header';

export default function ExercisesScreen() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      Promise.all([findAll(), findAllMeasurements()])
        .then(([all, allMeasurements]) => {
          setExercises(all);
          setMeasurements(allMeasurements);
        })
        .catch((e) => setError(String(e)));
    }, []),
  );

  const nameOf = (id: string) => measurements.find((m) => m.id === id)?.name ?? id;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background px-5 pt-4 dark:bg-background-dark">
      <SectionHeader
        title="Exercices"
        subtitle={`${exercises.length} définition${exercises.length > 1 ? 's' : ''} · référentiel`}
      />

      <FlatList
        data={exercises}
        keyExtractor={(item) => item.id}
        contentContainerClassName="gap-3 pb-4"
        ListEmptyComponent={
          <EmptyState
            title="Aucun exercice"
            description="Un exercice définit ce que tu fais et comment sa performance se mesure."
          />
        }
        renderItem={({ item }) => (
          <Card>
            <Text className="font-bold text-[17px] text-ink dark:text-ink-dark">{item.name}</Text>
            <View className="mt-1 flex-row flex-wrap gap-1.5">
              {item.measurementIds.map((id) => (
                <Tag key={id} label={nameOf(id)} />
              ))}
              {item.isUnilateral && <Tag label="unilatéral" accent />}
            </View>
          </Card>
        )}
      />

      {error && <Text className="pb-2 text-danger dark:text-danger-dark">{error}</Text>}

      <Link href="/new-exercise" asChild>
        <Button label="Nouvel exercice" size="lg" className="mb-2" />
      </Link>
    </SafeAreaView>
  );
}

function Tag({ label, accent = false }: { label: string; accent?: boolean }) {
  return (
    <View
      className={
        accent
          ? 'rounded-full bg-primary-soft px-2.5 py-1 dark:bg-primary-soft-dark'
          : 'rounded-full bg-surface-alt px-2.5 py-1 dark:bg-surface-alt-dark'
      }
    >
      <Text
        className={
          accent
            ? 'font-mono text-[11px] text-primary-ink dark:text-primary-ink-dark'
            : 'font-mono text-[11px] text-muted dark:text-muted-dark'
        }
      >
        {label}
      </Text>
    </View>
  );
}
