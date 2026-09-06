import { businessMessageOf } from '../domain/domain-error';

/**
 * Le texte à montrer pour une erreur remontée jusqu'à l'écran.
 *
 * Un refus métier est destiné à l'utilisateur : on l'affiche tel quel. Une
 * panne, elle, produit un message écrit pour un développeur -- le présenter
 * comme une règle du domaine ferait croire qu'on a mal fait quelque chose,
 * alors que c'est l'application qui a échoué.
 */
export function messageOf(error: unknown): string {
  const business = businessMessageOf(error);
  if (business !== null) return business;

  console.error(error);
  return "Quelque chose n'a pas fonctionné. Réessaie, et signale-le si ça se reproduit.";
}
