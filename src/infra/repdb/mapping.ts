import type { MuscleId } from '../../domain/exercise/muscle';

/**
 * La traduction du vocabulaire de RepDB vers le nôtre.
 *
 * Leur catalogue est anatomique (`rectus_abdominis`, `soleus`), le nôtre est
 * un vocabulaire d'entraînement en douze groupes. Cette table est la
 * FRONTIÈRE entre les deux : notre modèle ne doit pas être défini par le
 * fichier d'un tiers, sans quoi il changerait le jour où ce fichier change.
 *
 * Un slug absent d'ici est IGNORÉ. Nous n'avons pas de groupe pour les
 * adducteurs, les fléchisseurs de hanche ou le grand dentelé : les ranger de
 * force ailleurs inventerait une information que le dataset ne donne pas.
 */
export const MUSCLE_BY_SLUG: Readonly<Record<string, MuscleId>> = {
  pectoralis_major: 'pectoraux',

  latissimus_dorsi: 'dos',
  trapezius: 'dos',
  rhomboids: 'dos',

  anterior_deltoid: 'epaules',
  lateral_deltoid: 'epaules',
  posterior_deltoid: 'epaules',
  supraspinatus: 'epaules',

  biceps_brachii: 'biceps',
  // Le brachial travaille avec le biceps et ne se distingue pas à l'entraînement.
  brachialis: 'biceps',
  triceps_brachii: 'triceps',

  brachioradialis: 'avantbras',
  forearm_flexors: 'avantbras',
  forearm_extensors: 'avantbras',
  forearms: 'avantbras',

  rectus_abdominis: 'abdominaux',
  transverse_abdominis: 'abdominaux',
  obliques: 'abdominaux',

  erector_spinae: 'lombaires',
  quadratus_lumborum: 'lombaires',

  gluteus_maximus: 'fessiers',
  gluteus_medius: 'fessiers',

  quadriceps: 'quadriceps',
  hamstrings: 'ischiojambiers',

  gastrocnemius: 'mollets',
  soleus: 'mollets',
};

/** Le dataset donne des chemins relatifs ; l'hôte est celui de sa licence. */
const IMAGE_HOST = 'https://exercise-dataset.com';

/** Ce que nous lisons d'une entrée du catalogue ; le reste ne nous sert pas. */
export type CatalogueEntry = {
  readonly id: string;
  readonly name: string;
  readonly equipment: string;
  readonly primaryMuscles: readonly string[];
  readonly secondaryMuscles: readonly string[];
  readonly isUnilateral: boolean;
  readonly isBodyweight: boolean;
  /** Les deux illustrations, telles que le dataset les nomme. */
  readonly images: readonly string[];
};

/** Le brouillon d'exercice qu'une entrée propose : à relire et à corriger. */
export type ExerciseDraft = {
  readonly name: string;
  readonly isUnilateral: boolean;
  readonly measurementIds: readonly string[];
  readonly primaryMuscleId: string | null;
  readonly secondaryMuscleIds: readonly string[];
  /** Les adresses des illustrations ; rien n'est téléchargé à ce stade. */
  readonly imageUris: readonly string[];
};

/**
 * Traduit une entrée en brouillon.
 *
 * Leur « muscle principal » peut en contenir PLUSIEURS (`hamstrings|
 * quadriceps`), là où nous n'en admettons qu'un. Plutôt que de relâcher
 * l'invariant pour accommoder un fichier tiers, le premier groupe traduit
 * devient le principal et les autres rejoignent les secondaires -- l'import
 * remplit un formulaire, c'est l'utilisateur qui arbitre.
 */
export function toDraft(entry: CatalogueEntry): ExerciseDraft {
  const primaries = translate(entry.primaryMuscles);
  const [primaryMuscleId = null, ...demoted] = primaries;

  const secondaries = [...demoted, ...translate(entry.secondaryMuscles)].filter(
    (id) => id !== primaryMuscleId,
  );

  return {
    name: entry.name,
    isUnilateral: entry.isUnilateral,
    // Au poids du corps, la charge n'a rien à mesurer. Une tenue se mesure en
    // secondes, mais le dataset ne le dit pas : c'est à corriger dans le
    // formulaire, et lui seul peut le savoir.
    measurementIds: entry.isBodyweight ? ['reps'] : ['reps', 'weight'],
    primaryMuscleId,
    secondaryMuscleIds: [...new Set(secondaries)],
    imageUris: entry.images.map((path) => `${IMAGE_HOST}/${path}`),
  };
}

/** Les groupes que ces slugs désignent, sans doublon et dans l'ordre. */
function translate(slugs: readonly string[]): MuscleId[] {
  const groups = slugs
    .map((slug) => MUSCLE_BY_SLUG[slug])
    .filter((id): id is MuscleId => id !== undefined);
  return [...new Set(groups)];
}
