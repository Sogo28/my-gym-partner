import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Measurement } from '../../src/domain/exercise/measurement';
import type { ExerciseMedia } from '../../src/domain/exercise/media';
import { sourceOf } from '../../src/domain/exercise/media';
import type { Muscle } from '../../src/domain/exercise/muscle';
import { findAllMeasurements, findAllMuscles } from '../../src/infra/exercise-repository';
import { BarChart } from '../../src/ui/bar-chart';
import { Card } from '../../src/ui/card';
import { Collapsible } from '../../src/ui/collapsible';
import { EmptyState } from '../../src/ui/empty-state';
import { formatDateTime } from '../../src/ui/format';
import { messageOf } from '../../src/ui/message';
import { BusinessNotice } from '../../src/ui/notice';
import { BackHeader } from '../../src/ui/screen-header';
import { cn } from '../../src/ui/cn';
import { formatSetValues } from '../../src/ui/set-values';
import { Sheet } from '../../src/ui/sheet';
import { Tag } from '../../src/ui/tag';
import { discardExercise, unarchiveExercise } from '../../src/use-cases/edit-catalogue';
import { mediaExists, mediaUri } from '../../src/use-cases/media-actions';
import { bestValue } from '../../src/domain/performance/records';
import { getExerciseDetail, type ExerciseDetail } from '../../src/use-cases/exercise-detail';

/** Par paquets de cinq : de quoi voir la tendance récente sans dérouler l'an dernier. */
const PAGE = 5;

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
  /** La mesure suivie par le graphe, quand l'exercice en porte plusieurs. */
  const [tracked, setTracked] = useState<string | null>(null);
  /** Combien de séances passées on montre sous la dernière. */
  const [shown, setShown] = useState(PAGE);
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

  const charted = tracked ?? exercise.measurementIds[0];
  // Les séances arrivent de la plus récente à la plus ancienne ; un graphe se
  // lit dans l'autre sens.
  const points = [...sessions]
    .reverse()
    .map((entry) => ({ value: bestValue(entry.sets, charted), at: entry.session.startedAt }))
    .filter((point): point is { value: number; at: Date } => point.value !== null);

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

        {/* Les démonstrations sont ce qu'on vient revoir AVANT de s'y mettre :
            elles passent devant les chiffres. */}
        {exercise.media.length > 0 && (
          <View className="gap-2">
            {exercise.media.map((item) =>
              item.kind === 'file' ? (
                <LocalVideo key={item.uri} media={item} />
              ) : (
                <Pressable
                  key={item.uri}
                  // Ouvert dans son application d'origine : l'afficher ici
                  // demanderait une vue web, et Instagram la refuse une fois
                  // sur deux.
                  onPress={() =>
                    Linking.openURL(item.uri).catch(() =>
                      setError("Ce lien n'a pas pu être ouvert."),
                    )
                  }
                >
                  <Card className="flex-row items-center justify-between gap-3">
                    <View className="shrink">
                      <Text
                        className="font-bold text-[15px] text-ink dark:text-ink-dark"
                        numberOfLines={1}
                      >
                        {item.label ?? sourceOf(item)}
                      </Text>
                      <Text
                        className="font-mono text-[11px] text-muted dark:text-muted-dark"
                        numberOfLines={1}
                      >
                        {sourceOf(item)}
                      </Text>
                    </View>
                    <Text className="shrink-0 text-[13px] text-primary-ink dark:text-primary-ink-dark">
                      ouvrir
                    </Text>
                  </Card>
                </Pressable>
              ),
            )}
          </View>
        )}

        {sessions.length === 0 ? (
          <EmptyState
            title="Aucune performance"
            description="Cet exercice n'a encore été travaillé dans aucune séance."
          />
        ) : (
          <>
            {/* Les records en bandeau : trois nombres qui se lisent d'un coup
                d'oeil, là où trois cartes empilées se lisaient une par une. */}
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
                  label="Volume"
                  value={`${Math.round(volume.value * 10) / 10}`}
                  unit="kg"
                />
              )}
            </View>

            {/* La carte reste là même sans courbe à tracer : les puces
                d'unité vivent dedans, et les faire disparaître enfermerait
                sur la mesure qu'on vient de choisir. */}
            <Card density="titled" className="gap-3">
                <View className="flex-row items-center justify-between gap-3">
                  <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
                    Meilleure série par séance
                  </Text>
                  {/* Une seule mesure : rien à choisir, donc rien à afficher. */}
                  {exercise.measurementIds.length > 1 && (
                    <View className="flex-row gap-1.5">
                      {exercise.measurementIds.map((measurementId) => {
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
                                'font-mono text-[11px]',
                                on
                                  ? 'text-primary-ink dark:text-primary-ink-dark'
                                  : 'text-muted dark:text-muted-dark',
                              )}
                            >
                              {unitOf(measurementId)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              {points.length > 1 ? (
                <BarChart points={points} unit={unitOf(charted)} />
              ) : (
                <Text className="py-4 text-center text-[13px] text-muted dark:text-muted-dark">
                  {points.length === 0
                    ? `Aucune série enregistrée en ${unitOf(charted)}.`
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

            <Section title="Dernière séance">
              <SessionCard
                open
                at={last.session.startedAt}
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
                      key={entry.session.id}
                      at={entry.session.startedAt}
                      lines={entry.sets.map((set) => formatSetValues(set.values, unitOf) || '—')}
                    />
                  ))}
                  {previous.length > shown && (
                    <Pressable onPress={() => setShown((count) => count + PAGE)} className="py-2">
                      <Text className="text-center text-[13px] text-primary-ink dark:text-primary-ink-dark">
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
        <Text className="font-mono text-[13px] text-muted dark:text-muted-dark">
          {formatDateTime(at)}
        </Text>
      }
      summary={`${lines.length} série${lines.length > 1 ? 's' : ''}`}
    >
      {lines.map((line, index) => (
        <Text
          key={index}
          className="font-mono-bold text-[15px] text-ink dark:text-ink-dark"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {index + 1}. {line}
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
        className="font-mono-bold text-[22px] text-ink dark:text-ink-dark"
        numberOfLines={1}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {value}
        <Text className="font-sans text-[12px] text-muted dark:text-muted-dark"> {unit}</Text>
      </Text>
      <Text className="text-[11px] text-muted dark:text-muted-dark" numberOfLines={1}>
        {label}
      </Text>
    </Card>
  );
}

/**
 * Une vidéo prise sur ce téléphone.
 *
 * Composant à part : chaque lecteur a son propre `useVideoPlayer`, et un
 * crochet ne peut pas naître au milieu d'une boucle.
 */
function LocalVideo({ media }: { media: ExerciseMedia }) {
  // Le fichier peut manquer : une sauvegarde restaurée ailleurs ramène la
  // ligne, jamais la vidéo.
  const present = mediaExists(media);
  const trim = media.trim;
  const player = useVideoPlayer(present ? mediaUri(media) : null, (instance) => {
    // Un extrait boucle sur lui-même : le lecteur natif, lui, ne sait boucler
    // que sur la vidéo entière.
    instance.loop = trim === null;
    if (trim) instance.currentTime = trim.from;
  });

  useEffect(() => {
    if (!trim) return;
    // Le retour au début se fait sur les battements du lecteur : l'interroger
    // nous-mêmes à intervalle fixe ferait tourner du JavaScript pour rien.
    player.timeUpdateEventInterval = 0.2;
    const subscription = player.addListener('timeUpdate', ({ currentTime }) => {
      if (currentTime >= trim.to) player.currentTime = trim.from;
    });
    return () => subscription.remove();
  }, [player, trim]);

  if (!present) {
    return (
      <Card className="gap-1">
        <Text className="font-bold text-[15px] text-ink dark:text-ink-dark">
          {media.label ?? 'Vidéo'}
        </Text>
        <Text className="text-[12px] text-muted dark:text-muted-dark">
          Fichier introuvable sur ce téléphone.
        </Text>
      </Card>
    );
  }

  return (
    <View className="overflow-hidden rounded-2xl border border-border bg-black dark:border-border-dark">
      <VideoView player={player} style={{ width: '100%', height: 200 }} contentFit="contain" />
    </View>
  );
}
