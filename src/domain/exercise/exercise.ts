import { normalizeMedia, type ExerciseMedia } from './media';
import type { MeasurementId } from './measurement';
import type { MuscleId } from './muscle';
import { DomainError } from '../domain-error';

export type ExerciseId = string;

export type CreateExerciseInput = {
  /** Fourni par l'appelant : le domaine ne génère pas d'identifiants (voir note en bas). */
  id: ExerciseId;
  name: string;
  isUnilateral: boolean;
  measurementIds: readonly MeasurementId[];
  /**
   * Le muscle que l'exercice vise en premier. Facultatif : un exercice peut
   * n'en cibler aucun, et rien ne dépend de ce choix.
   */
  primaryMuscleId?: MuscleId | null;
  /** Ceux qui travaillent en soutien. Facultatif également. */
  secondaryMuscleIds?: readonly MuscleId[];
  /** Démonstrations rattachées, dans l'ordre où on les a ajoutées. */
  media?: readonly ExerciseMedia[];
  /**
   * D'où vient l'exercice, quand il ne vient pas de toi : `repdb:pull-up`.
   *
   * Un FAIT, pas un réglage : il se pose à la création et ne change plus. Il
   * sert à savoir ce qui a déjà été adopté d'un catalogue tiers, ce qu'aucune
   * autre donnée ne dit une fois l'exercice renommé en français.
   */
  origin?: string | null;
};

/**
 * Exercise : la définition d'un exercice (§4).
 *
 * Aggregate Root (décision gelée n°1). Il définit ce qu'est l'exercice et
 * comment sa performance peut être mesurée -- jamais les valeurs mesurées,
 * qui appartiennent aux données de performance.
 *
 * Les Measurement sont référencés PAR IDENTIFIANT et non par objet : ce sont
 * des agrégats distincts, avec leur propre cycle de vie. Un exercice ne peut
 * donc pas modifier une mesure, seulement s'y référer.
 */
export class Exercise {
  private constructor(
    readonly id: ExerciseId,
    private _name: string,
    readonly isUnilateral: boolean,
    private _measurementIds: readonly MeasurementId[],
    private _primaryMuscleId: MuscleId | null,
    private _secondaryMuscleIds: readonly MuscleId[],
    private _media: readonly ExerciseMedia[],
    readonly origin: string | null,
    private _isArchived: boolean,
  ) {}

  static create(input: CreateExerciseInput): Exercise {
    const name = normalizeName(input.name);
    const measurementIds = normalizeMeasurementIds(input.measurementIds);
    return new Exercise(
      input.id,
      name,
      input.isUnilateral,
      measurementIds,
      input.primaryMuscleId ?? null,
      normalizeSecondaries(input.primaryMuscleId ?? null, input.secondaryMuscleIds ?? []),
      normalizeMedia(input.media ?? []),
      input.origin ?? null,
      false,
    );
  }

  /** Utilisé par le repository pour recharger un exercice existant. */
  static restore(input: CreateExerciseInput & { isArchived: boolean }): Exercise {
    return new Exercise(
      input.id,
      input.name,
      input.isUnilateral,
      [...input.measurementIds],
      input.primaryMuscleId ?? null,
      [...(input.secondaryMuscleIds ?? [])],
      [...(input.media ?? [])],
      input.origin ?? null,
      input.isArchived,
    );
  }

  get name(): string {
    return this._name;
  }

  get measurementIds(): readonly MeasurementId[] {
    return this._measurementIds;
  }

  get primaryMuscleId(): MuscleId | null {
    return this._primaryMuscleId;
  }

  get secondaryMuscleIds(): readonly MuscleId[] {
    return [...this._secondaryMuscleIds];
  }

  /**
   * Tous les muscles sollicités, le principal en tête.
   *
   * Ce que demandent le filtre du catalogue et la recherche d'exercices
   * soutenant une mensuration : ils cherchent « qui travaille ce muscle »,
   * sans distinguer au premier ou au second plan.
   */
  get muscleIds(): readonly MuscleId[] {
    return this._primaryMuscleId === null
      ? [...this._secondaryMuscleIds]
      : [this._primaryMuscleId, ...this._secondaryMuscleIds];
  }

  get media(): readonly ExerciseMedia[] {
    return [...this._media];
  }

  get isArchived(): boolean {
    return this._isArchived;
  }

  rename(newName: string): void {
    this._name = normalizeName(newName);
  }

  /**
   * Changer les mesures d'un exercice n'affecte AUCUNE performance passée :
   * chacune a copié les siennes au moment où elle a eu lieu (§2). On peut
   * donc corriger une définition sans réécrire l'histoire.
   */
  changeMeasurements(measurementIds: readonly MeasurementId[]): void {
    this._measurementIds = normalizeMeasurementIds(measurementIds);
  }

  /**
   * Les muscles ciblés servent à retrouver un exercice, jamais à juger une
   * performance : les modifier n'a donc aucun effet sur l'historique, et
   * n'en cibler aucun reste valide.
   */
  changeMuscles(
    primaryMuscleId: MuscleId | null,
    secondaryMuscleIds: readonly MuscleId[],
  ): void {
    this._primaryMuscleId = primaryMuscleId;
    this._secondaryMuscleIds = normalizeSecondaries(primaryMuscleId, secondaryMuscleIds);
  }

  /**
   * Une démonstration ne dit rien de ce qui a été fait : la changer, comme
   * les muscles, n'a aucun effet sur l'historique.
   */
  changeMedia(media: readonly ExerciseMedia[]): void {
    this._media = normalizeMedia(media);
  }

  /**
   * Archiver plutôt que supprimer : l'exercice sort des listes de choix mais
   * reste rattaché à tout ce qu'il a produit. Supprimer romprait le lien avec
   * des performances qui, elles, ont bien eu lieu.
   */
  archive(): void {
    this._isArchived = true;
  }

  unarchive(): void {
    this._isArchived = false;
  }
}

function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new DomainError("Le nom d'un exercice ne peut pas être vide.");
  }
  return trimmed;
}

/**
 * Un muscle est visé au premier plan OU en soutien, jamais les deux : la
 * distinction ne voudrait plus rien dire, et l'affichage compterait deux fois
 * le même muscle.
 */
function normalizeSecondaries(
  primaryMuscleId: MuscleId | null,
  secondaryMuscleIds: readonly MuscleId[],
): readonly MuscleId[] {
  if (primaryMuscleId !== null && secondaryMuscleIds.includes(primaryMuscleId)) {
    throw new DomainError('Le muscle principal ne peut pas être aussi secondaire.');
  }
  return [...new Set(secondaryMuscleIds)];
}

function normalizeMeasurementIds(ids: readonly MeasurementId[]): readonly MeasurementId[] {
  if (ids.length === 0) {
    throw new DomainError('Un exercice doit être mesurable par au moins une mesure.');
  }
  if (new Set(ids).size !== ids.length) {
    throw new DomainError('Un exercice ne peut pas référencer deux fois la même mesure.');
  }
  return [...ids];
}
