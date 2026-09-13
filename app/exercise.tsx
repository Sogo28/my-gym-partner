import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Measurement } from '../src/domain/exercise/measurement';
import type { Muscle } from '../src/domain/exercise/muscle';
import { findAllMeasurements, findAllMuscles } from '../src/infra/exercise-repository';
import { LineChart } from '../src/ui/line-chart';

/**
 * La courbe suit le volume, ou une mesure précise.
 *
 * Ce n'est pas un identifiant de mesure : le volume n'en est pas une, c'est
 * le produit de toutes. D'où un nom à part, qui ne peut se confondre avec
 * aucune mesure du catalogue.
 */
const VOLUME = 'volume';
import { Card } from '../src/ui/card';
import { Collapsible } from '../src/ui/collapsible';
import { EmptyState } from '../src/ui/empty-state';
import { formatDateTime } from '../src/ui/format';
import { useNotifications } from '../src/ui/notifications';
import { messageOf } from '../src/ui/message';
import { BackHeader } from '../src/ui/screen-header';
import { cn } from '../src/ui/cn';
import { formatSetValues } from '../src/ui/set-values';
import { Sheet } from '../src/ui/sheet';
import { MediaStrip } from '../src/ui/media-strip';
import { Tag } from '../src/ui/tag';
import { TrimmedVideo } from '../src/ui/trimmed-video';
import { discardExercise, unarchiveExercise } from '../src/use-cases/edit-catalogue';
import { bestValue, bestVolume } from '../src/domain/performance/records';
import { getExerciseDetail, type ExerciseDetail } from '../src/use-cases/exercise-detail';

/** Par paquets de cinq : de quoi voir la tendance récente sans dérouler l'an dernier. */
const PAGE = 5;

/**
 * La fiche d'un exercice : ce qu'il est, et ce qu'il a produit.
 *
 * Route plate, l'identifiant en paramètre -- comme le formulaire. Une pile
 * `exercises/[id]` donnait au geste de retour d'Android une racine à laquelle
 * revenir : /exercises, un écran sans identifiant, qui s'affichait donc en
 * « Exercice introuvable » au lieu de rendre la main à la liste.
 *
 * Consulter n'est pas modifier. Tant que la liste ouvrait le formulaire,
 * regarder un exercice et le casser par mégarde étaient le même geste ; le
 * formulaire est maintenant derrière le menu.
 */
export default function ExerciseDetailScreen() {
  const { notify } = useNotifications();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<ExerciseDetail | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [muscles, setMuscles] = useState<Muscle[]>([]);
  const [sheet, setSheet] = useState<'none' | 'menu' | 'confirm-discard'>('none');
  /** Faux dès qu'on quitte l'écran : les vidéos ne tournent pas derrière. */
  const [active, setActive] = useState(false);
  /** La mesure suivie par le graphe, quand l'exercice en porte plusieurs. */
  const [tracked, setTracked] = useState<string | null>(null);
  /** Combien de séances passées on montre sous la dernière. */
  const [shown, setShown] = useState(PAGE);

  // À chaque affichage : revenir du formulaire, ou d'une séance, doit montrer
  // l'exercice tel qu'il est maintenant.
  useFocusEffect(
    useCallback(() => {
      setActive(true);
      return () => setActive(false);
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      Promise.all([getExerciseDetail(id), findAllMeasurements(), findAllMuscles()])
        .then(([found, allMeasurements, allMuscles]) => {
          setDetail(found);
          setMeasurements(allMeasurements);
          setMuscles(allMuscles);
        })
        .catch((e) => notify(messageOf(e)));
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
      <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background p-5 pb-8 dark:bg-background-dark">
        <BackHeader title="Exercice" onBack={() => router.back()} />
        <Text className="text-muted dark:text-muted-dark">Exercice introuvable.</Text>
      </SafeAreaView>
    );
  }

  const { exercise, sessions, records, volume, goals } = detail;
  const [last, ...previous] = sessions;
  const totalSets = sessions.reduce((total, entry) => total + entry.sets.length, 0);

  /**
   * Ce que la courbe suit.
   *
   * Le VOLUME par défaut dès que l'exercice a plusieurs mesures : une mesure
   * prise seule n'en dit qu'une moitié -- soixante kilos ne distingue pas
   * cinq répétitions de douze, et c'est pourtant la différence qui dit si
   * l'on progresse. Avec une seule mesure, il n'y a pas de volume, et cette
   * mesure EST la progression.
   */
  const hasVolume = exercise.measurementIds.length > 1;
  const charted = tracked ?? (hasVolume ? VOLUME : exercise.measurementIds[0]);

  // Les séances arrivent de la plus récente à la plus ancienne ; une courbe
  // se lit dans l'autre sens.
  const points = [...sessions]
    .reverse()
    .map((entry) => ({
      value:
        charted === VOLUME
          ? (bestVolume(entry.sets)?.value ?? null)
          : bestValue(entry.sets, charted),
      at: entry.startedAt,
    }))
    .filter((point): point is { value: number; at: Date } => point.value !== null);

  async function discard() {
    try {
      await discardExercise(exercise);
      router.back();
    } catch (e) {
      notify(messageOf(e));
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background pb-3 dark:bg-background-dark">
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

      <ScrollView contentContainerClassName="gap-5 px-5 pb-8" keyboardShouldPersistTaps="handled">

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

        {/* Les démonstrations sont ce qu'on vient revoir AVANT de s'y mettre :
            elles passent devant les chiffres. */}
        <MediaStrip media={exercise.media} active={active} />

        {sessions.length === 0 ? (
          <EmptyState
            inline
            title="Aucune performance"
            description="Cet exercice n'a encore été travaillé dans aucune séance."
          />
        ) : (
          <>
            {/* Les records en bandeau : trois nombres qui se lisent d'un coup
                d'oeil, là où trois cartes empilées se lisaient une par une.
                Le titre est ce qui les dit RECORDS : sans lui, ce ne sont que
                des nombres posés sous les illustrations. */}
            <Section title="Records">
            <View className="flex-row gap-2">
              {records.map((record) => (
                <Stat
                  key={record.measurementId}
                  label={measurementNameOf(record.measurementId)}
                  value={`${record.value}`}
                  unit={unitOf(record.measurementId)}
                />
              ))}
              {/* Le volume n'apparaît que si l'exercice porte les deux mesures
                  dont il est le produit. */}
              {volume && (
                <Stat
                  label="Volume/série"
                  value={`${Math.round(volume.value * 10) / 10}`}
                  unit="kg"
                />
              )}
            </View>
            </Section>

            {/* La carte reste là même sans courbe à tracer : les puces
                d'unité vivent dedans, et les faire disparaître enfermerait
                sur la mesure qu'on vient de choisir. */}
            <Card density="titled" className="gap-3">
                <View className="flex-row items-center justify-between gap-3">
                  <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
                    Meilleure série par séance
                  </Text>
                  {/* Une seule mesure : rien à choisir, donc rien à afficher. */}
                  {hasVolume && (
                    <View className="flex-row gap-1.5">
                      {[VOLUME, ...exercise.measurementIds].map((measurementId) => {
                        const on = measurementId === charted;
                        return (
                          <Pressable
                            key={measurementId}
                            onPress={() => setTracked(measurementId)}
                            className={cn(
                              'h-8 justify-center rounded-full px-3',
                              on
                                ? 'bg-primary-soft dark:bg-primary-soft-dark'
                                : 'bg-surface-alt dark:bg-surface-alt-dark',
                            )}
                          >
                            <Text
                              className={cn(
                                'font-mono text-caption',
                                on
                                  ? 'text-primary-ink dark:text-primary-ink-dark'
                                  : 'text-muted dark:text-muted-dark',
                              )}
                            >
                              {measurementId === VOLUME ? 'volume' : unitOf(measurementId)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              {points.length > 1 ? (
                // Le volume n'a pas d'unité : des kilos par répétition ne
                // sont une grandeur d'aucune physique. C'est un indice,
                // comparable à lui-même d'une séance à l'autre.
                <LineChart
                  points={points}
                  unit={charted === VOLUME ? undefined : unitOf(charted)}
                />
              ) : (
                <Text className="py-4 text-center text-small text-muted dark:text-muted-dark">
                  {points.length === 0
                    ? charted === VOLUME
                      ? 'Aucune série ne porte les deux mesures.'
                      : `Aucune série enregistrée en ${unitOf(charted)}.`
                    : 'Une seule séance : rien à comparer pour l instant.'}
                </Text>
              )}
            </Card>

            {goals.length > 0 && (
              <Section title="Objectifs">
                <View className="gap-2">
                  {goals.map((goal) => (
                    <Card key={goal.id} className="flex-row items-center justify-between gap-3">
                      <Text
                        className="shrink font-bold text-body text-ink dark:text-ink-dark"
                        numberOfLines={1}
                      >
                        {goal.name}
                      </Text>
                      <Text className="text-caption text-muted dark:text-muted-dark">
                        {goal.status === 'ACTIVE' ? 'en cours' : 'archivé'}
                      </Text>
                    </Card>
                  ))}
                </View>
              </Section>
            )}

            <Section title="Dernière séance">
              <SessionCard
                open
                at={last.startedAt}
                lines={last.sets.map((set) => formatSetValues(set.values, unitOf) || '—')}
              />
            </Section>

            {/* L'historique se déplie : c'est la partie la plus longue de la
                page, et la moins souvent regardée. */}
            {previous.length > 0 && (
              <Collapsible
                title="Historique"
                summary={`${previous.length} séance${previous.length > 1 ? 's' : ''} de plus`}
              >
                {/* Par paquets plutôt qu'en hauteur bornée : un défilement
                    dans un défilement se dispute le geste avec la page. */}
                <View className="gap-2 py-1">
                  {previous.slice(0, shown).map((entry) => (
                    <SessionCard
                      key={entry.sessionId}
                      at={entry.startedAt}
                      lines={entry.sets.map((set) => formatSetValues(set.values, unitOf) || '—')}
                    />
                  ))}
                  {previous.length > shown && (
                    <Pressable onPress={() => setShown((count) => count + PAGE)} className="py-2">
                      <Text className="text-center text-small text-primary-ink dark:text-primary-ink-dark">
                        Afficher {Math.min(PAGE, previous.length - shown)} séance
                        {Math.min(PAGE, previous.length - shown) > 1 ? 's' : ''} de plus
                      </Text>
                    </Pressable>
                  )}
                </View>
              </Collapsible>
            )}
          </>
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
                    .catch((e) => notify(messageOf(e))),
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

/**
 * Une séance et ce qu'elle a produit sur cet exercice.
 *
 * Dépliable dans l'historique, ouverte pour la dernière séance : là, ses
 * séries sont ce qu'on est venu voir.
 */
function SessionCard({ at, lines, open = false }: { at: Date; lines: string[]; open?: boolean }) {
  return (
    <Collapsible
      defaultOpen={open}
      title={
        <Text className="font-mono text-small text-muted dark:text-muted-dark">
          {formatDateTime(at)}
        </Text>
      }
      summary={`${lines.length} série${lines.length > 1 ? 's' : ''}`}
    >
      {lines.map((line, index) => (
        <Text
          key={index}
          className="font-mono text-small text-ink dark:text-ink-dark"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {index + 1}.  {line}
        </Text>
      ))}
    </Collapsible>
  );
}

/** Un record en bandeau : le nombre d'abord, ce qu'il mesure en dessous. */
function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <Card className="flex-1 gap-0.5">
      <Text
        className="font-mono-bold text-heading text-ink dark:text-ink-dark"
        numberOfLines={1}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {value}
        <Text className="font-sans text-caption text-muted dark:text-muted-dark"> {unit}</Text>
      </Text>
      <Text className="text-micro text-muted dark:text-muted-dark" numberOfLines={1}>
        {label}
      </Text>
    </Card>
  );
}
