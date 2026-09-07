import { messageOf } from '../src/ui/message';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Exercise } from '../src/domain/exercise/exercise';
import type { Measurement } from '../src/domain/exercise/measurement';
import type { ExerciseMedia } from '../src/domain/exercise/media';
import { normalizeMedia, sourceOf, trimLabel } from '../src/domain/exercise/media';
import type { Muscle } from '../src/domain/exercise/muscle';
import { findAll, findAllMeasurements, findAllMuscles } from '../src/infra/exercise-repository';
import { Button } from '../src/ui/button';
import { BusinessNotice } from '../src/ui/notice';
import { OptionChip, OptionSheet } from '../src/ui/option-sheet';
import { Sheet } from '../src/ui/sheet';
import { BackHeader } from '../src/ui/screen-header';
import { createExercise } from '../src/use-cases/create-exercise';
import { forgetUnusedMedia, mediaUri, pickVideo } from '../src/use-cases/media-actions';
import {
  catalogueState,
  draftFrom,
  searchCatalogue,
  type CatalogueEntry,
} from '../src/use-cases/repdb-actions';
import { SearchField } from '../src/ui/search';
import { TrimSheet } from '../src/ui/trim-sheet';
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
  const [muscles, setMuscles] = useState<Muscle[]>([]);
  const [primaryMuscle, setPrimaryMuscle] = useState<string | null>(null);
  const [secondaryMuscles, setSecondaryMuscles] = useState<string[]>([]);
  const [media, setMedia] = useState<ExerciseMedia[]>([]);
  /** Le lien en cours de saisie, ou null quand la feuille est fermée. */
  const [link, setLink] = useState<{ uri: string; label: string } | null>(null);
  /** La vidéo dont on règle les bornes, s'il y en a une. */
  const [trimming, setTrimming] = useState<ExerciseMedia | null>(null);
  /** L'import depuis le catalogue : sa recherche, et ce qu'elle renvoie. */
  const [importing, setImporting] = useState(false);
  const [hasCatalogue, setHasCatalogue] = useState(false);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<CatalogueEntry[]>([]);
  /** La feuille de choix ouverte, s'il y en a une. */
  const [choosing, setChoosing] = useState<'none' | 'measurements' | 'primary' | 'secondary'>(
    'none',
  );
  /** Le menu de l'écran, et la confirmation qu'il peut demander. */
  const [sheet, setSheet] = useState<'none' | 'menu' | 'confirm-discard'>('none');
  const [error, setError] = useState<string | null>(null);

  const toggle =
    (set: (update: (current: string[]) => string[]) => void) => (id: string) =>
      set((current) =>
        current.includes(id) ? current.filter((other) => other !== id) : [...current, id],
      );

  // Les catalogues se rechargent à chaque affichage...
  useFocusEffect(
    useCallback(() => {
      findAllMeasurements().then(setMeasurements).catch((e) => setError(messageOf(e)));
      findAllMuscles().then(setMuscles).catch((e) => setError(messageOf(e)));
      // ...y compris celui de RepDB, qu'on a pu télécharger entre-temps.
      setHasCatalogue(catalogueState().downloaded);
    }, []),
  );

  /**
   * L'import REMPLIT le formulaire, il ne crée rien.
   *
   * Le nom arrive en anglais, les mesures sont devinées d'après « au poids du
   * corps », et un muscle que nous ne nommons pas a été écarté : rien de tout
   * cela ne doit atterrir en base sans que tu l'aies relu.
   */
  function fill(entry: CatalogueEntry) {
    const draft = draftFrom(entry);
    setName(draft.name);
    setIsUnilateral(draft.isUnilateral);
    setSelected([...draft.measurementIds]);
    setPrimaryMuscle(draft.primaryMuscleId);
    setSecondaryMuscles([...draft.secondaryMuscleIds]);
    // Les illustrations remplacent celles d'un import précédent, et laissent
    // intactes les vidéos qu'on aurait déjà ajoutées soi-même.
    setMedia((current) => [
      ...current.filter((item) => item.kind !== 'image'),
      ...draft.imageUris.map((uri) => ({
        kind: 'image' as const,
        uri,
        label: null,
        trim: null,
      })),
    ]);
    setImporting(false);
    setError(null);
  }

  // ...mais l'exercice à modifier une seule fois : le relire écraserait ce
  // qu'on est en train de saisir.
  useEffect(() => {
    if (!id) return;

    findAll()
      .then((all) => {
        const exercise = all.find((candidate) => candidate.id === id);
        if (!exercise) return;
        setExisting(exercise);
        setName(exercise.name);
        setIsUnilateral(exercise.isUnilateral);
        setSelected([...exercise.measurementIds]);
        setPrimaryMuscle(exercise.primaryMuscleId);
        setSecondaryMuscles([...exercise.secondaryMuscleIds]);
        setMedia([...exercise.media]);
      })
      .catch((e) => setError(messageOf(e)));
  }, [id]);

  async function submit() {
    try {
      // Aucune validation ici : les règles appartiennent au domaine.
      if (existing) {
        await updateExercise({
          exercise: existing,
          name,
          measurementIds: selected,
          primaryMuscleId: primaryMuscle,
          secondaryMuscleIds: secondaryMuscles,
          media,
        });
      } else {
        await createExercise({
          name,
          isUnilateral,
          measurementIds: selected,
          primaryMuscleId: primaryMuscle,
          secondaryMuscleIds: secondaryMuscles,
          media,
        });
      }
      // Une vidéo retirée du formulaire n'est effacée qu'ICI : tant que
      // l'enregistrement n'a pas eu lieu, l'exercice en base la réclame encore.
      await forgetUnusedMedia();
      router.back();
    } catch (e) {
      setError(messageOf(e));
    }
  }

  /** La vidéo choisie est copiée dans l'application avant d'être retenue. */
  async function addVideo() {
    try {
      const picked = await pickVideo();
      if (picked) setMedia((current) => [...current, picked]);
      setError(null);
    } catch (e) {
      setError(messageOf(e));
    }
  }

  /**
   * Le lien est validé par le DOMAINE, pas par l'écran : une adresse sans
   * schéma est refusée ici plutôt que d'échouer en silence le jour où on
   * essaie de l'ouvrir.
   */
  function addLink() {
    if (!link) return;
    const draft: ExerciseMedia = {
      kind: 'link',
      uri: link.uri,
      label: link.label.trim() || null,
      trim: null,
    };
    try {
      const next = normalizeMedia([...media, draft]);
      setMedia([...next]);
      setLink(null);
      setError(null);
    } catch (e) {
      setError(messageOf(e));
    }
  }

  /** Archivé s'il a déjà servi, supprimé sinon : c'est la base qui tranche. */
  async function discard() {
    if (!existing) return;
    try {
      await discardExercise(existing);
      await forgetUnusedMedia();
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
          // Rien à retirer tant que l'exercice n'existe pas : pas de menu.
          onMenu={existing ? () => setSheet('menu') : undefined}
        />
      </View>

      <ScrollView contentContainerClassName="gap-6 px-5 pb-8">
        {/* Modifier un exercice existant, c'est corriger CE qu'il est : y
            déverser un exercice du catalogue écraserait tout. */}
        {!existing && hasCatalogue && (
          <Button
            label="Remplir depuis le catalogue"
            variant="secondary"
            size="md"
            onPress={() => {
              setQuery('');
              setFound(searchCatalogue(''));
              setImporting(true);
            }}
          />
        )}

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
          <OptionChip
            options={measurements}
            selected={selected}
            emptyLabel="Choisir des mesures"
            plural="mesures"
            onPress={() => setChoosing('measurements')}
          />
        </View>

        <View className="gap-2">
          <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
            Muscle principal
          </Text>
          <Text className="text-[13px] text-muted dark:text-muted-dark">
            Facultatif. Ce que l'exercice vise en premier.
          </Text>
          <OptionChip
            options={muscles}
            selected={primaryMuscle ? [primaryMuscle] : []}
            emptyLabel="Aucun muscle principal"
            plural="muscles"
            onPress={() => setChoosing('primary')}
          />
        </View>

        <View className="gap-2">
          <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
            Muscles secondaires
          </Text>
          <Text className="text-[13px] text-muted dark:text-muted-dark">
            Ceux qui travaillent en soutien. Sert à retrouver l'exercice, jamais à juger une
            performance.
          </Text>
          <OptionChip
            options={muscles}
            selected={secondaryMuscles}
            emptyLabel="Aucun muscle secondaire"
            plural="muscles"
            onPress={() => setChoosing('secondary')}
          />
        </View>

        <View className="gap-2">
          <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
            Démonstrations
          </Text>
          <Text className="text-[13px] text-muted dark:text-muted-dark">
            Un lien vers une vidéo, ou une vidéo prise sur ce téléphone. Un lien s'ouvre dans son
            application ; un fichier se lit ici, mais n'entre pas dans tes sauvegardes.
          </Text>

          {media.map((item) => (
            <Pressable
              key={item.uri}
              // Seul un fichier se règle : d'un lien, nous ne pilotons pas la
              // lecture.
              onPress={item.kind === 'file' ? () => setTrimming(item) : undefined}
              className="flex-row items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 dark:border-border-dark dark:bg-surface-dark"
            >
              <View className="shrink">
                <Text className="font-medium text-[15px] text-ink dark:text-ink-dark" numberOfLines={1}>
                  {item.label ?? sourceOf(item)}
                </Text>
                <Text className="font-mono text-[11px] text-muted dark:text-muted-dark" numberOfLines={1}>
                  {item.kind === 'file'
                    ? item.trim
                      ? trimLabel(item.trim)
                      : 'vidéo entière · régler l extrait'
                    : item.kind === 'image'
                      ? 'illustration du catalogue'
                      : item.uri}
                </Text>
              </View>
              <Pressable
                onPress={() => setMedia((current) => current.filter((m) => m.uri !== item.uri))}
                hitSlop={8}
              >
                <Text className="text-[12px] text-danger dark:text-danger-dark">retirer</Text>
              </Pressable>
            </Pressable>
          ))}

          <View className="flex-row gap-2">
            <Button
              label="+ Lien"
              variant="secondary"
              size="md"
              className="flex-1"
              onPress={() => setLink({ uri: '', label: '' })}
            />
            <Button
              label="+ Vidéo"
              variant="secondary"
              size="md"
              className="flex-1"
              onPress={addVideo}
            />
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

      <View className="p-5 pt-2">
        <View className="flex-row gap-3">
          <Button
            label="Annuler"
            variant="secondary"
            size="lg"
            className="flex-1"
            onPress={() => router.back()}
          />
          <Button
            label={existing ? 'Enregistrer' : "Créer l'exercice"}
            size="lg"
            className="flex-1"
            onPress={submit}
          />
        </View>
      </View>

      <Sheet
        visible={importing}
        title="Catalogue d exercices"
        description="Le nom arrive en anglais : renomme-le comme tu l appelles."
        onClose={() => setImporting(false)}
      >
        <View className="gap-2 pb-2">
          <SearchField
            value={query}
            onChange={(next) => {
              setQuery(next);
              setFound(searchCatalogue(next));
            }}
            placeholder="Chercher dans le catalogue"
          />
          <ScrollView className="max-h-80" contentContainerClassName="gap-2">
            {found.length === 0 && (
              <Text className="py-3 text-center text-[13px] text-muted dark:text-muted-dark">
                Aucun exercice ne correspond.
              </Text>
            )}
            {found.map((entry) => (
              <Pressable
                key={entry.id}
                onPress={() => fill(entry)}
                className="rounded-lg border border-border bg-surface px-4 py-3 dark:border-border-dark dark:bg-surface-dark"
              >
                <Text className="font-medium text-[15px] text-ink dark:text-ink-dark">
                  {entry.name}
                </Text>
                <Text className="font-mono text-[11px] text-muted dark:text-muted-dark">
                  {entry.equipment.replace(/_/g, ' ')}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Sheet>

      <TrimSheet
        visible={trimming !== null}
        media={trimming}
        uri={trimming ? mediaUri(trimming) : null}
        onConfirm={(trim) => {
          const target = trimming;
          setTrimming(null);
          if (!target) return;
          setMedia((current) =>
            current.map((item) => (item.uri === target.uri ? { ...item, trim } : item)),
          );
        }}
        onClose={() => setTrimming(null)}
      />

      <Sheet
        visible={link !== null}
        title="Ajouter un lien"
        description="L'adresse de la vidéo, telle que tu la copies depuis l'application."
        onClose={() => setLink(null)}
      >
        {link && (
          <View className="gap-3 pb-2">
            <TextInput
              className="h-14 rounded-lg border-2 border-border bg-surface px-4 text-[15px] text-ink dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
              placeholder="https://youtube.com/..."
              placeholderTextColor="#A8AD9E"
              value={link.uri}
              onChangeText={(uri) => setLink((current) => current && { ...current, uri })}
              autoCapitalize="none"
              autoCorrect={false}
              inputMode="url"
            />
            <TextInput
              className="h-14 rounded-lg border-2 border-border bg-surface px-4 text-[15px] text-ink dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
              placeholder="Intitulé (facultatif)"
              placeholderTextColor="#A8AD9E"
              value={link.label}
              onChangeText={(label) => setLink((current) => current && { ...current, label })}
            />
            <Button label="Ajouter" size="md" onPress={addLink} />
          </View>
        )}
      </Sheet>

      <Sheet
        visible={sheet === 'menu'}
        title={existing?.name ?? 'Exercice'}
        actions={
          existing?.isArchived
            ? [
                {
                  label: 'Remettre au catalogue',
                  onPress: () =>
                    unarchiveExercise(existing)
                      .then(() => router.back())
                      .catch((e) => setError(messageOf(e))),
                },
              ]
            : [
                {
                  label: 'Retirer du catalogue',
                  tone: 'danger' as const,
                  onPress: () => setSheet('confirm-discard'),
                },
              ]
        }
        onClose={() => setSheet('none')}
      />

      {/* Retirer n'est pas toujours la même opération : la base tranche entre
          archiver et supprimer. La confirmation annonce les deux, faute de
          pouvoir dire laquelle avant d'avoir regardé. */}
      <Sheet
        visible={sheet === 'confirm-discard'}
        title="Retirer cet exercice ?"
        description="S'il a déjà servi, il est archivé et reste attaché à ton historique. Sinon, il est supprimé."
        actions={[{ label: 'Retirer', tone: 'danger', onPress: discard }]}
        onClose={() => setSheet('none')}
      />

      <OptionSheet
        visible={choosing === 'measurements'}
        title="Mesures"
        options={measurements}
        selected={selected}
        clearLabel="Tout décocher"
        confirmLabel={`${selected.length} mesure${selected.length > 1 ? 's' : ''}`}
        onToggle={toggle(setSelected)}
        onClear={() => setSelected([])}
        onClose={() => setChoosing('none')}
      />

      <OptionSheet
        visible={choosing === 'primary'}
        title="Muscle principal"
        mode="single"
        options={muscles}
        selected={primaryMuscle ? [primaryMuscle] : []}
        clearLabel="Aucun"
        confirmLabel="Fermer"
        // Choisir un muscle principal le retire des secondaires : il ne peut
        // pas soutenir un mouvement dont il est déjà la cible.
        onToggle={(id) => {
          setPrimaryMuscle(id);
          setSecondaryMuscles((current) => current.filter((other) => other !== id));
        }}
        onClear={() => setPrimaryMuscle(null)}
        onClose={() => setChoosing('none')}
      />

      <OptionSheet
        visible={choosing === 'secondary'}
        title="Muscles secondaires"
        // Le muscle principal ne se propose pas ici : il a déjà son rôle.
        options={muscles.filter((muscle) => muscle.id !== primaryMuscle)}
        selected={secondaryMuscles}
        clearLabel="Tout décocher"
        confirmLabel={`${secondaryMuscles.length} muscle${secondaryMuscles.length > 1 ? 's' : ''}`}
        onToggle={toggle(setSecondaryMuscles)}
        onClear={() => setSecondaryMuscles([])}
        onClose={() => setChoosing('none')}
      />

    </SafeAreaView>
  );
}
