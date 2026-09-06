/**
 * Muscle : un groupe musculaire sollicité par un exercice.
 *
 * Élément de catalogue, comme Measurement : « Dos », « dos » et « Dorsaux »
 * saisis librement deviendraient trois muscles distincts, et le filtre ne
 * servirait plus à rien.
 *
 * Un exercice peut n'en cibler aucun : c'est une aide au classement, pas une
 * caractéristique dont dépendrait une performance.
 */
export type MuscleId = string;

export type Muscle = {
  readonly id: MuscleId;
  readonly name: string;
};
