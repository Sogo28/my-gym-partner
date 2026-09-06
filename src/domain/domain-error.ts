/**
 * Un refus métier : une règle du domaine s'oppose à ce qui est demandé.
 *
 * À distinguer d'une panne. « Termine l'exercice en cours avant d'en
 * commencer un autre » n'est pas un incident : c'est le domaine qui fait son
 * travail, et le message est destiné à l'utilisateur tel quel.
 *
 * Une erreur ordinaire, elle, signale un défaut du code ou de la machine :
 * son message ne veut rien dire pour qui s'entraîne, et l'écran ne doit pas
 * le présenter comme une règle.
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

/** Le message à montrer, ou null si l'erreur n'est pas un refus métier. */
export function businessMessageOf(error: unknown): string | null {
  return error instanceof DomainError ? error.message : null;
}
