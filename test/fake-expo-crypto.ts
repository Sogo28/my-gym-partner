/**
 * L'API d'expo-crypto utilisée par les use cases, servie par Node.
 *
 * Les identifiants restent de vrais UUID : les tests vérifient donc que le
 * code les fabrique bien au bon endroit, sans les rendre prévisibles.
 */
export function randomUUID(): string {
  return crypto.randomUUID();
}
