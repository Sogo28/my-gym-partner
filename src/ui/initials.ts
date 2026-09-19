/**
 * Les initiales à montrer dans l'avatar, tirées d'une adresse e-mail.
 *
 * On n'a pas de nom : un compte n'est qu'une adresse et un mot de passe.
 * C'est donc la partie avant l'arobase qu'on lit, en la découpant sur ce qui
 * sépare d'ordinaire un prénom d'un nom -- point, tiret, souligné, chiffre.
 *
 * `daniel.ogodieme@…` donne « DO », `daniel@…` donne « D ». Jamais plus de
 * deux lettres : au-delà, l'avatar devient une étiquette.
 */
export function initialsOf(email: string): string {
  const local = email.trim().split('@')[0] ?? '';
  const words = local.split(/[^\p{L}]+/u).filter((word) => word !== '');

  return words
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');
}
