import * as Haptics from 'expo-haptics';

/**
 * Ce que la main sent quand l'écran a pris un geste.
 *
 * En salle, on ne regarde pas toujours le téléphone au moment de taper : il
 * est posé au sol, ou tenu d'une main pendant que l'autre range une barre.
 * Une vibration dit « c'est pris » sans qu'on ait à relever les yeux.
 *
 * Peu de signaux, chacun réservé à un moment : vibrer à chaque tap en ferait
 * un bruit de fond, et on cesserait de le sentir.
 *
 * Comme le son, c'est un confort : si le téléphone ne sait pas vibrer, rien
 * ne casse.
 */
function safely(feedback: () => Promise<void>): void {
  feedback().catch(() => {});
}

/** Une série vient d'être enregistrée : le geste qui compte le plus. */
export function feelSetDone(): void {
  safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Une série, un round ou une séance démarre. */
export function feelStart(): void {
  safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** Un choix parmi plusieurs vient de changer : un jour, un onglet. */
export function feelSelection(): void {
  safely(() => Haptics.selectionAsync());
}

/** Un record vient de tomber : le même signal qu'une série, c'en est la suite. */
export function feelRecord(): void {
  safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/**
 * Un tour de repos de plus : le seul signal qui arrive sans qu'on ait rien
 * touché. Plus appuyé qu'un tap pris -- trois impulsions --, il doit se
 * sentir à travers une poche et ne pas se confondre avec le départ d'une
 * série.
 */
export function feelRestLap(): void {
  safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}
