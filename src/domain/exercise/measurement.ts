/**
 * Measurement : un type de mesure réutilisable (répétitions, poids, durée...).
 *
 * C'est un Aggregate Root (décision gelée n°2), mais un agrégat sans règle forte :
 * il définit une unité, jamais une valeur de performance (§5).
 *
 * En Slice 1 il n'a ni création ni modification : on se contente d'un petit
 * catalogue en lecture. Ses use cases viendront quand un besoin réel apparaîtra.
 */
export type MeasurementId = string;

export type Measurement = {
  readonly id: MeasurementId;
  readonly name: string;
  /** Unité affichée à l'utilisateur : "reps", "kg", "s"... */
  readonly unit: string;
};
