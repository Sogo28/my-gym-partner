import type { ExerciseId } from '../exercise/exercise';
import type { MeasurementId } from '../exercise/measurement';
import { DomainError } from '../domain-error';

export type PlannedWorkoutId = string;

/**
 * Les valeurs cibles d'une série : "8 répétitions à +10 kg" devient
 * { reps: 8, weight: 10 }. L'unité n'est pas répétée ici, elle est portée
 * par la Measurement correspondante.
 */
export type TargetValues = Readonly<Record<MeasurementId, number>>;

/**
 * Une série planifiée. Chaque série porte ses propres cibles : le cahier des
 * charges insiste sur ce point (§6), les séries d'un même exercice peuvent
 * viser des valeurs différentes (8 reps, puis 7, puis 6).
 *
 * Simple objet de données, pas une classe : une série planifiée n'a pas
 * d'identité propre ni de comportement -- elle est définie entièrement par
 * ses valeurs. On la remplace plutôt qu'on ne la modifie.
 */
export type PlannedSet = {
  readonly targets: TargetValues;
};

export type PlannedExercise = {
  readonly exerciseId: ExerciseId;
  readonly sets: readonly PlannedSet[];
  /**
   * L'exercice se fait au rythme de l'horloge : un round toutes les
   * `intervalSeconds`, et non quand on se sent prêt (EMOM). `null` : les
   * séries s'enchaînent librement, séparées par le repos qu'on prend.
   *
   * L'intervalle est porté par l'exercice PLANIFIÉ et non par l'Exercise :
   * les tractions se font en EMOM dans un entraînement et en séries libres
   * dans un autre, c'est une décision d'entraînement (§6).
   *
   * Le nombre de rounds n'est PAS un champ de plus : c'est le nombre de
   * séries prévues. Un round est une série -- la slice 1 l'a déjà établi
   * côté séance -- et deux compteurs pour la même chose finiraient par se
   * contredire. Rien n'impose non plus que les rounds visent tous la même
   * cible : l'intervalle dit comment ils s'enchaînent, pas ce qu'ils valent.
   */
  readonly intervalSeconds?: number | null;
};

/**
 * PlannedWorkout : un entraînement réutilisable, sans date (décision gelée n°9).
 *
 * Aggregate Root (n°3). Les exercices planifiés et leurs séries lui
 * APPARTIENNENT : ils n'existent pas hors de lui et disparaissent avec lui.
 * En revanche, les Exercise sont seulement RÉFÉRENCÉS par identifiant, car ce
 * sont des agrégats autonomes réutilisés par plusieurs entraînements.
 *
 * Un même exercice peut apparaître plusieurs fois (pull-ups en début et en fin
 * de séance). C'est pourquoi on désigne un exercice planifié par sa POSITION
 * et non par son exerciseId, qui ne serait pas discriminant.
 */
export class PlannedWorkout {
  private constructor(
    readonly id: PlannedWorkoutId,
    private _name: string,
    private _exercises: PlannedExercise[],
    private _isArchived: boolean,
  ) {}

  static create(input: {
    id: PlannedWorkoutId;
    name: string;
    exercises?: readonly PlannedExercise[];
    isArchived?: boolean;
  }): PlannedWorkout {
    return new PlannedWorkout(
      input.id,
      normalizeName(input.name),
      (input.exercises ?? []).map(normalizeExercise),
      input.isArchived ?? false,
    );
  }

  get name(): string {
    return this._name;
  }

  /**
   * L'ordre du tableau EST l'ordre des exercices dans la séance (§6).
   *
   * On renvoie une copie : contrairement à Exercise, le tableau interne est
   * réellement muté (addExercise fait un push). Sans copie, l'appelant
   * garderait une référence vivante sur les entrailles de l'agrégat.
   */
  get exercises(): readonly PlannedExercise[] {
    return [...this._exercises];
  }

  get isArchived(): boolean {
    return this._isArchived;
  }

  rename(newName: string): void {
    this._name = normalizeName(newName);
  }

  /**
   * Archiver un entraînement ne touche pas aux séances qui en sont issues :
   * elles ont eu lieu, et gardent leur lien.
   */
  archive(): void {
    this._isArchived = true;
  }

  unarchive(): void {
    this._isArchived = false;
  }

  /**
   * Remplace tout le contenu d'un coup.
   *
   * L'écran d'édition tient un brouillon complet et le remet tel quel : lui
   * faire rejouer chaque ajout et chaque retrait un par un ne dirait rien de
   * plus, et laisserait l'entraînement dans des états intermédiaires qui
   * n'ont jamais existé pour l'utilisateur.
   */
  replaceExercises(exercises: readonly PlannedExercise[]): void {
    this._exercises = exercises.map(normalizeExercise);
  }

  addExercise(exerciseId: ExerciseId): void {
    this._exercises.push({ exerciseId, sets: [], intervalSeconds: null });
  }

  removeExerciseAt(position: number): void {
    this._exercises.splice(requirePosition(this._exercises, position), 1);
  }

  addSet(position: number, targets: TargetValues): void {
    const index = requirePosition(this._exercises, position);
    const exercise = this._exercises[index];
    this._exercises[index] = {
      ...exercise,
      sets: [...exercise.sets, { targets: normalizeTargets(targets) }],
    };
  }

  removeSetAt(position: number, setIndex: number): void {
    const index = requirePosition(this._exercises, position);
    const exercise = this._exercises[index];
    if (setIndex < 0 || setIndex >= exercise.sets.length) {
      throw new DomainError("Cette série n'existe pas dans cet exercice.");
    }
    this._exercises[index] = {
      ...exercise,
      sets: exercise.sets.filter((_, i) => i !== setIndex),
    };
  }
}

/**
 * Règle volontairement dupliquée depuis Exercise : le nom d'un entraînement et
 * le nom d'un exercice se ressemblent aujourd'hui, mais ce sont deux règles
 * métier distinctes qui peuvent diverger. On ne factorise pas ce qui se
 * ressemble, on factorise ce qui a le même sens.
 */
function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new DomainError("Le nom d'un entraînement ne peut pas être vide.");
  }
  return trimmed;
}

function normalizeExercise(exercise: PlannedExercise): PlannedExercise {
  return {
    exerciseId: exercise.exerciseId,
    sets: exercise.sets.map((set) => ({ targets: normalizeTargets(set.targets) })),
    intervalSeconds: normalizeInterval(exercise.intervalSeconds),
  };
}

/**
 * Un intervalle est un nombre entier de secondes, et il en faut au moins
 * une : un round de zéro seconde serait déjà fini en commençant.
 *
 * Absent et `null` disent la même chose -- pas d'EMOM --, mais on ressort
 * toujours `null` : l'agrégat répond, il ne laisse pas l'appelant deviner si
 * le champ a été oublié ou refusé.
 */
function normalizeInterval(intervalSeconds: number | null | undefined): number | null {
  if (intervalSeconds === null || intervalSeconds === undefined) return null;
  if (!Number.isInteger(intervalSeconds) || intervalSeconds < 1) {
    throw new DomainError("L'intervalle d'un EMOM doit être d'au moins une seconde.");
  }
  return intervalSeconds;
}

function normalizeTargets(targets: TargetValues): TargetValues {
  const entries = Object.entries(targets);

  if (entries.length === 0) {
    throw new DomainError('Une série planifiée doit cibler au moins une mesure.');
  }
  for (const [measurementId, value] of entries) {
    // 0 est autorisé : un tirage au poids du corps cible bien 0 kg ajouté.
    if (!Number.isFinite(value) || value < 0) {
      throw new DomainError(`La cible de "${measurementId}" doit être un nombre positif.`);
    }
  }
  return Object.fromEntries(entries);
}

function requirePosition(exercises: readonly PlannedExercise[], position: number): number {
  if (!Number.isInteger(position) || position < 0 || position >= exercises.length) {
    throw new DomainError("Cet exercice n'existe pas dans cet entraînement.");
  }
  return position;
}
