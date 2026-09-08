/**
 * Ce qu'un formulaire vient de créer, à l'intention de l'écran qui l'avait
 * demandé.
 *
 * expo-router sait passer des paramètres à l'écran qu'on OUVRE, pas rendre
 * une réponse à celui qui revient : `router.back()` ne transporte rien. Et
 * republier l'écran d'origine avec un paramètre le remonterait, donc lui
 * ferait perdre le brouillon en cours -- exactement ce qu'on cherche à
 * préserver.
 *
 * D'où cette boîte aux lettres : une valeur, déposée à l'enregistrement,
 * relevée UNE FOIS par l'écran de retour. Elle ne se remplit que lorsque le
 * formulaire a été ouvert depuis un sélecteur, pour qu'un exercice créé
 * depuis le catalogue n'aille pas rouvrir un sélecteur ailleurs.
 */
let pending: string | null = null;

export function announceCreated(exerciseId: string): void {
  pending = exerciseId;
}

/** Relève la boîte : la valeur ne se lit qu'une fois. */
export function takeCreated(): string | null {
  const created = pending;
  pending = null;
  return created;
}
