/**
 * L'API d'expo-crypto utilisée par les use cases, servie par Node.
 *
 * Les identifiants restent de vrais UUID : les tests vérifient donc que le
 * code les fabrique bien au bon endroit, sans les rendre prévisibles.
 */
export function randomUUID(): string {
  return crypto.randomUUID();
}

export enum CryptoDigestAlgorithm {
  SHA256 = 'SHA-256',
}

/** L'empreinte d'un texte, en hexadécimal comme expo-crypto la rend. */
export async function digestStringAsync(
  algorithm: CryptoDigestAlgorithm,
  data: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(algorithm, new TextEncoder().encode(data));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
