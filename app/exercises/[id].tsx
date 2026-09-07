import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Measurement } from '../../src/domain/exercise/measurement';
import type { Muscle } from '../../src/domain/exercise/muscle';
import { findAllMeasurements, findAllMuscles } from '../../src/infra/exercise-repository';
import { Card } from '../../src/ui/card';
import { EmptyState } from '../../src/ui/empty-state';
import { formatDateTime } from '../../src/ui/format';
import { messageOf } from '../../src/ui/message';
import { BusinessNotice } from '../../src/ui/notice';
import { BackHeader } from '../../src/ui/screen-header';
import { formatSetValues } from '../../src/ui/set-values';
import { Sheet } from '../../src/ui/sheet';
import { Tag } from '../../src/ui/tag';
import { discardExercise, unarchiveExercise } from '../../src/use-cases/edit-catalogue';
import { getExerciseDetail, type ExerciseDetail } from '../../src/use-cases/exercise-detail';

/**
 * La fiche d'un exercice : ce qu'il est, et ce qu'il a produit.
 *
 * Consulter n'est pas modifier. Tant que la liste ouvrait le formulaire,
 * regarder un exercice et le casser par mégarde étaient le même geste ; le
 * formulaire est maintenant derrière le menu.
 */
export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<ExerciseDetail | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [muscles, setMuscles] = useState<Muscle[]>([]);
  const [sheet, setSheet] = useState<'none' | 'menu' | 'confirm-discard'>('none');
  const [error, setError] = useState<string | null>(null);

  // À chaque affichage : revenir du formulaire, ou d'une séance, doit montrer
  // l'exercice tel qu'il est maintenant.
  useFocusEffect(
    useCallback(() => {
      Promise.all([getExerciseDetail(id), findAllMeasurements(), findAllMuscles()])
        .then(([found, allMeasurements, allMuscles]) => {
          setDetail(found);
          setMeasurements(allMeasurements);
          setMuscles(allMuscles);
        })
        .catch((e) => setError(messageOf(e)));
    }, [id]),
  );

  const unitOf = (measurementId: string) =>
    measurements.find((m) => m.id === measurementId)?.unit ?? measurementId;
  const measurementNameOf = (measurementId: string) =>
    measurements.find((m) => m.id === measurementId)?.name ?? measurementId;
  const muscleNameOf = (muscleId: string) =>
    muscles.find((m) => m.id === muscleId)?.name ?? muscleId;

  if (!detail) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background p-5 dark:bg-background-dark">
        <BackHeader title="Exercice" onBack={() => router.back()} />
        <Text className="text-muted dark:text-muted-dark">{error ?? 'Exercice introuvable.'}</Text>
      </SafeAreaView>
    );
  }

  const { exercise, sessions, records, volume, goals } = detail;
  const [last, ...previous] = sessions;
  const totalSets = sessions.reduce((total, entry) => total + entry.sets.length, 0);

  async function discard() {
    try {
      await discardExercise(exercise);
      router.back();
    } catch (e) {
      setError(messageOf(e));
    }
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-5 pt-4">
        <BackHeader
          title={exercise.name}
          subtitle={
            totalSets === 0
              ? 'jamais travaillé'
              : `${totalSets} série${totalSets > 1 ? 's' : ''} · ${sessions.length} séance${sessions.length > 1 ? 's' : ''}`
          }
          onBack={() => router.back()}
          onMenu={() => setSheet('menu')}
        />
      </View>

      <ScrollView contentContainerClassName="gap-5 px-5 pb-8">
        {error && <BusinessNotice message={error} />}

        {/* Ce que l'exercice EST : ses mesures, ses muscles, sa nature. */}
        <View className="flex-row flex-wrap gap-1.5">
          {exercise.measurementIds.map((measurementId) => (
            <Tag key={measurementId} label={measurementNameOf(measurementId)} />
          ))}
          {exercise.primaryMuscleId && (
            <Tag label={muscleNameOf(exercise.primaryMuscleId)} variant="accent" />
          )}
          {exercise.secondaryMuscleIds.map((muscleId) => (
            <Tag key={muscleId} label={muscleNameOf(muscleId)} variant="accent-outline" />
          ))}
          {exercise.isUnilateral && <Tag label="unilatéral" variant="accent" />}
          {exercise.isArchived && <Tag label="archivé" />}
        </View>

        {sessions.length === 0 ? (
          <EmptyState
            title="Aucune performance"
            description="Cet exercice n'a encore été travaillé dans aucune séance."
          />
        ) : (
          <>
            <Section title="Records">
              <View className="gap-2">
                {records.map((record) => (
                  <Line
                    key={record.measurementId}
                    label={measurementNameOf(record.measurementId)}
                    value={`${record.value} ${unitOf(record.measurementId)}`}
                    note={formatDateTime(record.at)}
                  />
                ))}
                {/* Le volume n'apparaît que si l'exercice porte les deux
                    mesures dont il est le produit. */}
                {volume && (
                  <Line
                    label="Meilleur volume de série"
                    value={`${Math.round(volume.value * 10) / 10} kg`}
                    note={formatDateTime(volume.at)}
                  />
                )}
              </View>
            </Section>

            <Section title="Dernière séance">
              <SessionCard
                at={last.session.startedAt}
                lines={last.sets.map((set) => formatSetValues(set.values, unitOf) || '—')}
              />
            </Section>

            {previous.length > 0 && (
              <Section
                title={`Historique · ${previous.length} séance${previous.length > 1 ? 's' : ''}`}
              >
                <View className="gap-2">
                  {previous.map((entry) => (
                    <SessionCard
                      key={entry.session.id}
                      at={entry.session.startedAt}
                      lines={entry.sets.map((set) => formatSetValues(set.values, unitOf) || '—')}
                    />
                  ))}
                </View>
              </Section>
            )}
          </>
        )}

        {goals.length > 0 && (
          <Section title="Objectifs">
            <View className="gap-2">
              {goals.map((goal) => (
                <Card key={goal.id} className="flex-row items-center justify-between gap-3">
                  <Text
                    className="shrink font-bold text-[15px] text-ink dark:text-ink-dark"
                    numberOfLines={1}
                  >
                    {goal.name}
                  </Text>
                  <Text className="font-mono text-[12px] text-muted dark:text-muted-dark">
                    {goal.status === 'ACTIVE' ? 'en cours' : 'archivé'}
                  </Text>
                </Card>
              ))}
            </View>
          </Section>
        )}
      </ScrollView>

      <Sheet
        visible={sheet === 'menu'}
        title={exercise.name}
        actions={[
          {
            label: 'Modifier',
            onPress: () => router.push({ pathname: '/new-exercise', params: { id: exercise.id } }),
          },
          exercise.isArchived
            ? {
                label: 'Remettre au catalogue',
                onPress: () =>
                  unarchiveExercise(exercise)
                    .then(() => router.back())
                    .catch((e) => setError(messageOf(e))),
              }
            : {
                label: 'Retirer du catalogue',
                tone: 'danger' as const,
                onPress: () => setSheet('confirm-discard'),
              },
        ]}
        onClose={() => setSheet('none')}
      />

      <Sheet
        visible={sheet === 'confirm-discard'}
        title="Retirer cet exercice ?"
        description="S'il a déjà servi, il est archivé et reste attaché à ton historique. Sinon, il est supprimé."
        actions={[{ label: 'Retirer', tone: 'danger', onPress: discard }]}
        onClose={() => setSheet('none')}
      />
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">{title}</Text>
      {children}
    </View>
  );
}

/** Un record : ce qui est mesuré, la valeur, et quand elle a été faite. */
function Line({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card className="flex-row items-center justify-between gap-3">
      <View className="shrink">
        <Text className="font-bold text-[15px] text-ink dark:text-ink-dark">{label}</Text>
        <Text className="font-mono text-[11px] text-muted dark:text-muted-dark">{note}</Text>
      </View>
      <Text
        className="shrink-0 font-mono-bold text-[18px] text-ink dark:text-ink-dark"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>
    </Card>
  );
}

/** Une séance et ce qu'elle a produit sur cet exercice. */
function SessionCard({ at, lines }: { at: Date; lines: string[] }) {
  return (
    <Card density="titled" className="gap-1">
      <Text className="font-mono text-[12px] text-muted dark:text-muted-dark">
        {formatDateTime(at)}
      </Text>
      {lines.map((line, index) => (
        <Text
          key={index}
          className="font-mono-bold text-[15px] text-ink dark:text-ink-dark"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {index + 1}. {line}
        </Text>
      ))}
    </Card>
  );
}
