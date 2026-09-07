import { messageOf } from '../src/ui/message';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Exercise } from '../src/domain/exercise/exercise';
import type { Measurement } from '../src/domain/exercise/measurement';
import type { Muscle } from '../src/domain/exercise/muscle';
import { findAll, findAllMeasurements, findAllMuscles } from '../src/infra/exercise-repository';
import { Button } from '../src/ui/button';
import { BusinessNotice } from '../src/ui/notice';
import { OptionChip, OptionSheet } from '../src/ui/option-sheet';
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
  const [muscles, setMuscles] = useState<Muscle[]>([]);
  const [primaryMuscle, setPrimaryMuscle] = useState<string | null>(null);
  const [secondaryMuscles, setSecondaryMuscles] = useState<string[]>([]);
  /** La feuille de choix ouverte, s'il y en a une. */
  const [choosing, setChoosing] = useState<'none' | 'measurements' | 'primary' | 'secondary'>(
    'none',
  );
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
    }, []),
  );

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
        });
      } else {
        await createExercise({
          name,
          isUnilateral,
          measurementIds: selected,
          primaryMuscleId: primaryMuscle,
          secondaryMuscleIds: secondaryMuscles,
        });
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
        {/* Retirer ou remettre au catalogue reste au-dessus : c'est une action
            sur ce qui existe, pas une façon de quitter l'écran. */}
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
        ) : null}

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
