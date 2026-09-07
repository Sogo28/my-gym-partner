import { Link, useFocusEffect, useRouter } from 'expo-router';
import { messageOf } from '../src/ui/message';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Exercise } from '../src/domain/exercise/exercise';
import type { Measurement } from '../src/domain/exercise/measurement';
import type { Muscle } from '../src/domain/exercise/muscle';
import { Tag } from '../src/ui/tag';
import { findAll, findAllMeasurements, findAllMuscles } from '../src/infra/exercise-repository';
import { Card } from '../src/ui/card';
import { CatalogueRow } from '../src/ui/catalogue-row';
import { Fab } from '../src/ui/fab';
import { EmptyState } from '../src/ui/empty-state';
import { MuscleFilterChip, MuscleFilterSheet } from '../src/ui/muscle-filter';
import { SectionHeader } from '../src/ui/screen-header';
import { SearchField } from '../src/ui/search';
import { fold } from '../src/text';
import { catalogueSource } from '../src/use-cases/repdb-actions';
import type { CatalogueSuggestion } from '../src/ui/exercise-picker';

export default function ExercisesScreen() {
  const router = useRouter();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [muscles, setMuscles] = useState<Muscle[]>([]);
  /** Les muscles retenus au filtre. Vide : tout voir. */
  const [filter, setFilter] = useState<string[]>([]);
  const [filtering, setFiltering] = useState(false);
  const [query, setQuery] = useState('');
  /** Ce que le catalogue tiers propose pour cette recherche. */
  const [suggestions, setSuggestions] = useState<CatalogueSuggestion[]>([]);
  const [adopting, setAdopting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    Promise.all([findAll(), findAllMeasurements(), findAllMuscles()])
      .then(([all, allMeasurements, allMuscles]) => {
        setExercises(all);
        setMeasurements(allMeasurements);
        setMuscles(allMuscles);
      })
      .catch((e) => setError(messageOf(e)));
  }, []);

  useFocusEffect(reload);

  const catalogue = useMemo(() => catalogueSource(reload), [reload]);

  /**
   * Le catalogue ne répond qu'à une recherche : dérouler six cents entrées
   * sous les tiennes noierait les tiennes.
   */
  useEffect(() => {
    if (!catalogue.available || query.trim() === '') {
      setSuggestions([]);
      return;
    }
    let current = true;
    catalogue
      .suggest(query)
      .then((found) => {
        if (current) setSuggestions(found);
      })
      .catch(() => setSuggestions([]));
    return () => {
      current = false;
    };
  }, [catalogue, query]);

  /** Adopter crée l'exercice : la liste doit le montrer aussitôt. */
  async function adopt(id: string) {
    setAdopting(id);
    try {
      await catalogue.adopt(id);
      setSuggestions((current) => current.filter((entry) => entry.id !== id));
      setError(null);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setAdopting(null);
    }
  }

  const nameOf = (id: string) => measurements.find((m) => m.id === id)?.name ?? id;

  // Les exercices archivés ne polluent plus la liste, mais restent consultables.
  const [showArchived, setShowArchived] = useState(false);
  const archivedCount = exercises.filter((exercise) => exercise.isArchived).length;
  const muscleNameOf = (id: string) => muscles.find((m) => m.id === id)?.name ?? id;

  // Ne proposer au filtre que les muscles réellement présents au catalogue :
  // une liste de douze entrées dont dix ne donnent rien n'aide personne.
  const usedMuscles = muscles.filter((muscle) =>
    exercises.some((exercise) => exercise.muscleIds.includes(muscle.id)),
  );

  const shown = exercises
    .filter((exercise) => showArchived || !exercise.isArchived)
    .filter((exercise) => filter.length === 0 || exercise.muscleIds.some((id) => filter.includes(id)))
    .filter((exercise) => fold(exercise.name).includes(fold(query.trim())));

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background px-5 pt-4 dark:bg-background-dark">
      <SectionHeader
        title="Exercices"
        subtitle={`${exercises.length - archivedCount} définition${exercises.length - archivedCount > 1 ? 's' : ''} · référentiel`}
        // Les réglages tiennent au catalogue d'exercices : on y va d'ici.
        action={{ label: 'Réglages', onPress: () => router.push('/settings') }}
      />

      <View className="gap-3 pb-3">
        <SearchField value={query} onChange={setQuery} placeholder="Chercher un exercice" />
        {usedMuscles.length > 0 && (
          <MuscleFilterChip
            muscles={usedMuscles}
            selected={filter}
            onPress={() => setFiltering(true)}
          />
        )}
      </View>

      <FlatList
        data={shown}
        keyExtractor={(item) => item.id}
        // La liste s'arrête au-dessus de la pastille d'ajout.
        contentContainerClassName="gap-3 pb-28"
        ListEmptyComponent={
          <EmptyState
            title={query || filter.length > 0 ? 'Aucun résultat' : 'Aucun exercice'}
            description={
              query || filter.length > 0
                ? 'Aucun exercice ne correspond à cette recherche.'
                : 'Un exercice définit ce que tu fais et comment sa performance se mesure.'
            }
          />
        }
        ListFooterComponent={
          <>
            {archivedCount > 0 && (
              <Pressable onPress={() => setShowArchived((value) => !value)} className="py-3">
                <Text className="text-center text-[13px] text-muted dark:text-muted-dark">
                  {showArchived ? 'Masquer' : 'Afficher'} {archivedCount} exercice
                  {archivedCount > 1 ? 's' : ''} archivé{archivedCount > 1 ? 's' : ''}
                </Text>
              </Pressable>
            )}

            {/* Le catalogue vient APRÈS : ce que tu fais déjà passe devant ce
                qu'un tiers propose. */}
            {suggestions.length > 0 && (
              <View className="gap-2 pt-2">
                <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
                  Dans le catalogue
                </Text>
                {suggestions.map((entry) => (
                  <CatalogueRow
                    key={entry.id}
                    name={entry.name}
                    detail={entry.detail}
                    busy={adopting === entry.id}
                    onPress={() => adopt(entry.id)}
                  />
                ))}
              </View>
            )}

            {/* Ni chez toi ni dans le catalogue : c'est un exercice à écrire,
                et son nom est déjà tapé. */}
            {query.trim() !== '' && shown.length === 0 && suggestions.length === 0 && (
              <CatalogueRow
                name={`Créer « ${query.trim()} »`}
                detail="ouvre le formulaire, nom déjà rempli"
                onPress={() =>
                  router.push({ pathname: '/new-exercise', params: { name: query.trim() } })
                }
              />
            )}

            {!catalogue.available && query.trim() !== '' && (
              <Pressable onPress={() => router.push('/settings')} className="py-4">
                <Text className="text-center text-[13px] text-muted dark:text-muted-dark">
                  Le catalogue de 601 exercices n est pas téléchargé.
                </Text>
                <Text className="pt-1 text-center text-[13px] text-primary-ink dark:text-primary-ink-dark">
                  L installer depuis les réglages
                </Text>
              </Pressable>
            )}
          </>
        }
        renderItem={({ item }) => (
          <Link href={{ pathname: '/exercise', params: { id: item.id } }} asChild>
            <Pressable>
              <Card className={item.isArchived ? 'opacity-50' : undefined}>
                <Text className="font-bold text-[17px] text-ink dark:text-ink-dark">
                  {item.name}
                </Text>
                <View className="mt-1 flex-row flex-wrap gap-1.5">
                  {item.measurementIds.map((id) => (
                    <Tag key={id} label={nameOf(id)} />
                  ))}
                  {item.primaryMuscleId && (
                    <Tag label={muscleNameOf(item.primaryMuscleId)} variant="accent" />
                  )}
                  {item.secondaryMuscleIds.map((id) => (
                    <Tag key={id} label={muscleNameOf(id)} variant="accent-outline" />
                  ))}
                  {item.isUnilateral && <Tag label="unilatéral" variant="accent" />}
                  {item.isArchived && <Tag label="archivé" />}
                </View>
              </Card>
            </Pressable>
          </Link>
        )}
      />

      {error && <Text className="pb-2 text-danger dark:text-danger-dark">{error}</Text>}

      <Link href="/new-exercise" asChild>
        <Fab accessibilityLabel="Nouvel exercice" />
      </Link>

      <MuscleFilterSheet
        visible={filtering}
        muscles={usedMuscles}
        selected={filter}
        results={shown.length}
        onToggle={(id) =>
          setFilter((current) =>
            current.includes(id) ? current.filter((m) => m !== id) : [...current, id],
          )
        }
        onClear={() => setFilter([])}
        onClose={() => setFiltering(false)}
      />
    </SafeAreaView>
  );
}
