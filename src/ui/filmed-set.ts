/**
 * Le message que l'écran de captation laisse à la séance en revenant.
 *
 * Même boîte aux lettres que pour un exercice créé : `router.back()` ne
 * transporte rien, et republier l'écran de séance avec un paramètre le
 * remonterait -- lui faisant perdre ce qu'il tient.
 *
 * Ce qu'on y dépose : « l'enregistrement a été COUPÉ À LA MAIN ». Couper, à
 * ce moment-là, c'est dire qu'on a fini la série -- on ne s'arrête pas de
 * filmer au milieu d'un mouvement. La durée maximale atteinte ne dit rien de
 * tel : elle dit seulement que la vidéo est pleine.
 */
let stoppedByHand = false;

export function announceStoppedByHand(): void {
  stoppedByHand = true;
}

/** Relève la boîte : la valeur ne se lit qu'une fois. */
export function takeStoppedByHand(): boolean {
  const stopped = stoppedByHand;
  stoppedByHand = false;
  return stopped;
}
