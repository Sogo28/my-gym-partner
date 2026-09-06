import type { ExerciseId } from '../exercise/exercise';
import type { MeasurementId } from '../exercise/measurement';

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

  addExercise(exerciseId: ExerciseId): void {
    this._exercises.push({ exerciseId, sets: [] });
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
      throw new Error("Cette série n'existe pas dans cet exercice.");
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
    throw new Error("Le nom d'un entraînement ne peut pas être vide.");
  }
  return trimmed;
}

function normalizeExercise(exercise: PlannedExercise): PlannedExercise {
  return {
    exerciseId: exercise.exerciseId,
    sets: exercise.sets.map((set) => ({ targets: normalizeTargets(set.targets) })),
  };
}

function normalizeTargets(targets: TargetValues): TargetValues {
  const entries = Object.entries(targets);

  if (entries.length === 0) {
    throw new Error('Une série planifiée doit cibler au moins une mesure.');
  }
  for (const [measurementId, value] of entries) {
    // 0 est autorisé : un tirage au poids du corps cible bien 0 kg ajouté.
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`La cible de "${measurementId}" doit être un nombre positif.`);
    }
  }
  return Object.fromEntries(entries);
}

function requirePosition(exercises: readonly PlannedExercise[], position: number): number {
  if (!Number.isInteger(position) || position < 0 || position >= exercises.length) {
    throw new Error("Cet exercice n'existe pas dans cet entraînement.");
  }
  return position;
}
