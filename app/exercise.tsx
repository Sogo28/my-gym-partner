import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Side, ValuesBySide } from '../src/domain/performance/exercise-performance';
import type { Measurement } from '../src/domain/exercise/measurement';
import type { Muscle } from '../src/domain/exercise/muscle';
import { findAllMeasurements, findAllMuscles } from '../src/infra/exercise-repository';
import { findActive } from '../src/infra/workout-session-repository';
import { LineChart } from '../src/ui/line-chart';
import { Button } from '../src/ui/button';
import { DatePickerSheet } from '../src/ui/date-picker';
import { MeasureField } from '../src/ui/measure-field';
import { defaultTargets } from '../src/ui/set-defaults';
import { moveSession } from '../src/use-cases/move-session';
import {
  completePerformanceSet,
  finishActivity,
  finishWorkoutSession,
  startActivity,
  startPerformanceSet,
  startWorkoutSession,
} from '../src/use-cases/workout-session-actions';

/**
 * La courbe suit le volume, ou une mesure précise.
 *
 * Ce n'est pas un identifiant de mesure : le volume n'en est pas une, c'est
 * le produit de toutes. D'où un nom à part, qui ne peut se confondre avec
 * aucune mesure du catalogue.
 */
const VOLUME = 'volume';

/** Les fenêtres proposées sous la courbe, de la plus serrée à toutes. */
const WINDOWS: { label: string; sessions: number | null }[] = [
  { label: '12 dernières', sessions: 12 },
  { label: '30', sessions: 30 },
  { label: 'Tout', sessions: null },
];
import { Card } from '../src/ui/card';
import { Collapsible } from '../src/ui/collapsible';
import { EmptyState } from '../src/ui/empty-state';
import { formatDateTime, formatTime } from '../src/ui/format';
import { usePalette } from '../src/ui/palette';
import { useNotifications } from '../src/ui/notifications';
import { messageOf } from '../src/ui/message';
import { cn } from '../src/ui/cn';
import { formatMeasure, formatSetValues } from '../src/ui/set-values';
import { Sheet } from '../src/ui/sheet';
import { MediaStrip } from '../src/ui/media-strip';
import { Tag } from '../src/ui/tag';
import { TrimmedVideo } from '../src/ui/trimmed-video';
import { discardExercise, unarchiveExercise } from '../src/use-cases/edit-catalogue';
import { averageValue, averageVolume } from '../src/domain/performance/records';
import { getExerciseDetail, type ExerciseDetail } from '../src/use-cases/exercise-detail';
import { DetailContent, DetailLayout } from '../src/ui/detail-layout';
import { RecordsCard } from '../src/ui/records-card';
import { SetIndex } from '../src/ui/set-index';
import { SetVideoViewer, VideoBadge } from '../src/ui/set-video';
import { fileUri } from '../src/use-cases/media-actions';

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
  /** La vidéo de série ouverte, par son nom de fichier. */
  const [watching, setWatching] = useState<string | null>(null);
  /** Faux dès qu'on quitte l'écran : les vidéos ne tournent pas derrière. */
  const [active, setActive] = useState(false);
  /** La mesure suivie par le graphe, quand l'exercice en porte plusieurs. */
  /** Combien de séances passées on montre sous la dernière. */
  const [shown, setShown] = useState(PAGE);
  /** Combien de séances la courbe montre. Null : toutes. */
  const [window, setWindow] = useState<number | null>(WINDOWS[0].sessions);
  /**
   * Faux tant qu'une séance tourne déjà : le domaine n'en admet qu'une à la
   * fois, et logger une série isolée par-dessus n'aurait pas de sens.
   */
  const [canLogQuickSet, setCanLogQuickSet] = useState(false);
  /** La feuille de saisie rapide, et les valeurs qu'elle règle. */
  const [logging, setLogging] = useState(false);
  const [quickValues, setQuickValues] = useState<ValuesBySide>({});
  /** Quand la série a réellement eu lieu -- maintenant par défaut. */
  const [quickAt, setQuickAt] = useState(new Date());
  const [pickingDate, setPickingDate] = useState(false);

  // À chaque affichage : revenir du formulaire, ou d'une séance, doit montrer
  // l'exercice tel qu'il est maintenant.
  useFocusEffect(
    useCallback(() => {
      setActive(true);
      return () => setActive(false);
    }, []),
  );

  const reload = useCallback(() => {
    return Promise.all([
      getExerciseDetail(id),
      findAllMeasurements(),
      findAllMuscles(),
      findActive(),
    ]).then(([found, allMeasurements, allMuscles, activeSession]) => {
      setDetail(found);
      setMeasurements(allMeasurements);
      setMuscles(allMuscles);
      setCanLogQuickSet(activeSession === null);
    });
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      reload().catch((e) => notify(messageOf(e)));
    }, [reload]),
  );

  const unitOf = (measurementId: string) =>
    measurements.find((m) => m.id === measurementId)?.unit ?? measurementId;
  const measurementNameOf = (measurementId: string) =>
    measurements.find((m) => m.id === measurementId)?.name ?? measurementId;
  const muscleNameOf = (muscleId: string) =>
    muscles.find((m) => m.id === muscleId)?.name ?? muscleId;

  if (!detail) {
    return (
      <DetailLayout title="Exercice" onBack={() => router.back()}>
        <DetailContent>
          <Text className="text-muted dark:text-muted-dark">Exercice introuvable.</Text>
        </DetailContent>
      </DetailLayout>
    );
  }

  const { exercise, sessions, records, volume, goals } = detail;
  const [last, ...previous] = sessions;
  const totalSets = sessions.reduce((total, entry) => total + entry.sets.length, 0);

  /** Un exercice unilatéral porte deux côtés dans UNE série, jamais deux (§4). */
  const sides: Side[] = exercise.isUnilateral ? ['LEFT', 'RIGHT'] : ['BOTH'];
  const SIDE_LABELS: Record<string, string> = { BOTH: '', LEFT: 'Côté gauche', RIGHT: 'Côté droit' };

  /**
   * Ouvrir la saisie rapide reprend la dernière série faite -- sinon un
   * point de départ raisonnable -- plutôt que de partir d'un formulaire vide.
   */
  function openQuickLog() {
    const targets = defaultTargets(exercise.measurementIds);
    setQuickValues(
      last?.sets.at(-1)?.values ?? Object.fromEntries(sides.map((side) => [side, targets])),
    );
    setQuickAt(new Date());
    setLogging(true);
  }

  /**
   * Toute la cérémonie d'une séance -- démarrer, lancer l'exercice, valider
   * une série, refermer -- en un seul geste pour l'utilisateur : le "Grease
   * the Groove" ne connaît ni plan ni repos, juste une série de temps en
   * temps dans la journée.
   *
   * La séance naît à l'instant présent -- une séance date de sa première
   * série (§30) -- puis se DÉPLACE si la date choisie diffère, comme on
   * corrige quand une séance a eu lieu depuis sa fiche d'édition.
   */
  async function logQuickSet() {
    try {
      const session = await startWorkoutSession();
      await startActivity(exercise.id);
      await startPerformanceSet();
      await completePerformanceSet(quickValues);
      await finishActivity();
      await finishWorkoutSession();
      if (Math.abs(quickAt.getTime() - session.startedAt.getTime()) > 1000) {
        await moveSession(session.id, quickAt);
      }
      setLogging(false);
      notify('Série enregistrée.', 'success');
      await reload();
    } catch (e) {
      notify(messageOf(e));
    }
  }

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
  const charted = hasVolume ? VOLUME : exercise.measurementIds[0];

  // Les séances arrivent de la plus récente à la plus ancienne ; une courbe
  // se lit dans l'autre sens.
  const plotted = [...sessions]
    .reverse()
    .map((entry) => ({
      // La MOYENNE des séries de la séance, et non sa meilleure : une séance
      // est un ensemble, et sa meilleure série n'en raconte qu'une. Ni la
      // somme, qui monterait pour la seule raison qu'on a fait une série de
      // plus, même plus faible.
      value:
        charted === VOLUME
          ? averageVolume(entry.sets)
          : averageValue(entry.sets, charted),
      at: entry.startedAt,
    }))
    .filter((point): point is { value: number; at: Date } => point.value !== null);

  /**
   * Les dernières séances seulement.
   *
   * Ce n'est pas l'étiquette qui gêne au bout de cinquante séances, c'est le
   * point : sur la largeur d'un téléphone, il ne lui reste que quelques
   * pixels et la courbe devient une tache. La fenêtre se compte en SÉANCES et
   * non en jours, parce que c'est ce que porte l'abscisse -- une plage de
   * dates rendrait un nombre de points variable, et parfois aucun.
   */
  const points = window === null ? plotted : plotted.slice(-window);

  async function discard() {
    try {
      await discardExercise(exercise);
      router.back();
    } catch (e) {
      notify(messageOf(e));
    }
  }

  return (
    <DetailLayout
      title={exercise.name}
      subtitle={
        totalSets === 0
          ? 'Jamais travaillé'
          : `${totalSets} série${totalSets > 1 ? 's' : ''} · ${sessions.length} séance${sessions.length > 1 ? 's' : ''}`
      }
      onBack={() => router.back()}
      onMenu={() => setSheet('menu')}
    >
      <DetailContent className="gap-5">

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
          {exercise.isUnilateral && <Tag label="Unilatéral" variant="accent" />}
          {exercise.isArchived && <Tag label="Archivé" />}
        </View>

        {/* Les démonstrations sont ce qu'on vient revoir AVANT de s'y mettre :
            elles passent devant les chiffres. */}
        <MediaStrip media={exercise.media} active={active} />

        {sessions.length === 0 ? (
          <>
            <EmptyState
              inline
              title="Aucune performance"
              description="Cet exercice n'a encore été travaillé dans aucune séance."
            />
          </>
        ) : (
          <>
            {/* La même carte que le bilan d'une séance : chaque record dit ce
                qu'il a battu, « 13 reps → 14 reps ». Le volume n'apparaît
                qu'à partir de deux mesures -- avec une seule, son produit
                répéterait cette mesure --, et sans unité : des kilos par
                répétition ne sont une grandeur d'aucune physique. */}
            <RecordsCard
              title="Records"
              rows={[
                ...records.map((record) => ({
                  key: record.measurementId,
                  label: measurementNameOf(record.measurementId),
                  from:
                    record.previous === null
                      ? null
                      : formatMeasure(record.previous, unitOf(record.measurementId)),
                  to: formatMeasure(record.value, unitOf(record.measurementId)),
                })),
                ...(volume
                  ? [
                      {
                        key: 'volume',
                        label: 'Volume/série',
                        from:
                          volume.previous === null
                            ? null
                            : `${Math.round(volume.previous * 10) / 10}`,
                        to: `${Math.round(volume.value * 10) / 10}`,
                      },
                    ]
                  : []),
              ]}
            />

            {/* Ce que la courbe suit se DIT, au lieu de se choisir : à
                plusieurs mesures c'est le volume, à une seule c'est cette
                mesure. Les puces qui laissaient isoler une mesure sont
                parties -- une mesure seule ne dit qu'une moitié, et les
                garder revenait à proposer de mal lire. */}
            <Card density="titled" className="gap-3">
              <View className="gap-0.5">
                <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
                  {charted === VOLUME
                    ? 'Volume moyen par séance'
                    : `Moyenne par séance · ${unitOf(charted)}`}
                </Text>
                {charted !== VOLUME && (
                  <Text className="text-caption text-muted dark:text-muted-dark">
                    La moyenne de ses séries, séance par séance.
                  </Text>
                )}
              </View>

              {points.length > 1 ? (
                <>
                  <LineChart points={points} />

                  {/* Rien à choisir tant que tout tient : proposer une
                      fenêtre sur huit séances serait proposer d'en cacher. */}
                  {plotted.length > (WINDOWS[0].sessions ?? 0) && (
                    <View className="flex-row gap-2 pt-1">
                      {WINDOWS.map(({ label, sessions }) => {
                        const on = sessions === window;
                        return (
                          <Pressable
                            key={label}
                            onPress={() => setWindow(sessions)}
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
                              {label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </>
              ) : (
                <Text className="py-4 text-center text-small text-muted dark:text-muted-dark">
                  {points.length === 0
                    ? charted === VOLUME
                      ? 'Aucune série ne porte les deux mesures.'
                      : `Aucune série enregistrée en ${unitOf(charted)}.`
                    : "Une seule séance : rien à comparer pour l'instant."}
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
                        {goal.status === 'ACTIVE' ? 'En cours' : 'Archivé'}
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
                videos={last.sets.map((set) => set.videoUri)}
                onPlay={setWatching}
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
                      videos={entry.sets.map((set) => set.videoUri)}
                      onPlay={setWatching}
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
      </DetailContent>

      {/* Une série isolée, hors de toute séance -- le "Grease the Groove" ne
          connaît ni plan ni repos, juste une série de temps en temps dans la
          journée. */}
      <Sheet
        visible={logging}
        title="Enregistrer une série"
        description={exercise.name}
        onClose={() => setLogging(false)}
      >
        <View className="gap-4 pb-2">
          {/* Modifiable : une série de Grease the Groove se logge parfois
              après coup, et le moment où elle a EU LIEU compte plus que celui
              où on l'enregistre. */}
          <Pressable onPress={() => setPickingDate(true)}>
            <Card density="titled" className="flex-row items-center justify-between gap-3">
              <View className="shrink">
                <Text className="font-bold text-body text-ink dark:text-ink-dark">
                  Date et heure
                </Text>
                <Text className="font-mono text-caption text-muted dark:text-muted-dark">
                  {formatDateTime(quickAt)}
                </Text>
              </View>
              <Text className="text-caption text-primary-ink dark:text-primary-ink-dark">
                Modifier
              </Text>
            </Card>
          </Pressable>

          {sides.map((side) => (
            <View key={side} className="gap-1">
              {SIDE_LABELS[side] ? (
                <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
                  {SIDE_LABELS[side]}
                </Text>
              ) : null}
              <View className="flex-row gap-3">
                {exercise.measurementIds.map((measurementId) => (
                  <MeasureField
                    key={measurementId}
                    unit={unitOf(measurementId)}
                    measurementId={measurementId}
                    value={quickValues[side]?.[measurementId] ?? 0}
                    onChange={(value) =>
                      setQuickValues((current) => ({
                        ...current,
                        [side]: { ...(current[side] ?? {}), [measurementId]: value },
                      }))
                    }
                  />
                ))}
              </View>
            </View>
          ))}

          <Button label="Enregistrer" size="lg" onPress={logQuickSet} />
        </View>
      </Sheet>

      <DatePickerSheet
        visible={pickingDate}
        title="Quand cette série a eu lieu"
        initial={quickAt}
        onConfirm={(at) => {
          setQuickAt(at);
          setPickingDate(false);
        }}
        onClose={() => setPickingDate(false)}
      />

      <Sheet
        visible={sheet === 'menu'}
        title={exercise.name}
        actions={[
          // Une série isolée, hors séance : une action de la fiche parmi
          // d'autres, rangée dans son menu plutôt qu'en bouton dans la page.
          ...(canLogQuickSet
            ? [
                {
                  label: 'Enregistrer une série',
                  icon: 'add-circle-outline' as const,
                  onPress: openQuickLog,
                },
              ]
            : []),
          {
            label: 'Modifier',
            icon: 'create-outline',
            onPress: () => router.push({ pathname: '/new-exercise', params: { id: exercise.id } }),
          },
          exercise.isArchived
            ? {
                label: 'Remettre au catalogue',
                icon: 'arrow-undo-outline',
                onPress: () =>
                  unarchiveExercise(exercise)
                    .then(() => router.back())
                    .catch((e) => notify(messageOf(e))),
              }
            : {
                label: 'Retirer du catalogue',
                icon: 'archive-outline',
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
        actions={[{ label: 'Retirer', icon: 'trash-outline', tone: 'danger', onPress: discard }]}
        onClose={() => setSheet('none')}
      />
      {/* En lecture seule : d'ici, une série ne sait pas de quelle séance
          elle vient pour se voir retirer sa vidéo -- c'est le bilan de la
          séance qui le fait. */}
      <SetVideoViewer uri={watching ? fileUri(watching) : null} onClose={() => setWatching(null)} />
    </DetailLayout>
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
function SessionCard({
  at,
  lines,
  videos,
  onPlay,
  open = false,
}: {
  at: Date;
  lines: string[];
  /**
   * La vidéo de chaque série, quand elle a été filmée : à la place du temps
   * d'exécution, que personne ne regardait (retiré le 2026-10-08).
   */
  videos?: (string | null)[];
  onPlay?: (name: string) => void;
  open?: boolean;
}) {
  const { muted } = usePalette();

  return (
    <Collapsible
      defaultOpen={open}
      title={
        // Le jour et l'heure, chacun derrière son icône : deux informations
        // qu'on cherche séparément, plutôt qu'une date et une heure collées.
        <View className="flex-row items-center gap-3">
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="calendar-outline" size={14} color={muted} />
            <Text className="font-mono text-small text-ink dark:text-ink-dark">
              {at.toLocaleDateString('fr-FR')}
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="time-outline" size={14} color={muted} />
            <Text className="font-mono text-small text-ink dark:text-ink-dark">
              {formatTime(at)}
            </Text>
          </View>
        </View>
      }
    >
      <View className="gap-2">
        {lines.map((line, index) => (
          <View key={index} className="flex-row items-center justify-between gap-2">
            <View className="shrink flex-row items-center gap-2.5">
              <SetIndex index={index + 1} />
              <Text
                className="shrink font-mono text-small text-ink dark:text-ink-dark"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {line}
              </Text>
            </View>
            {videos?.[index] && onPlay && (
              <VideoBadge onPress={() => onPlay(videos[index]!)} />
            )}
          </View>
        ))}
      </View>
    </Collapsible>
  );
}
