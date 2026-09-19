/**
 * EMOM (Every Minute On the Minute, ou tout autre intervalle fixe) : un
 * round toutes les N secondes, pendant un nombre de rounds fixé à l'avance.
 *
 * Pur calcul sur l'horloge murale (`now - roundStartedAt`), jamais un
 * décompte qui s'incrémente tout seul et dérive dès que l'app passe en
 * arrière-plan -- même principe que le repos de la séance (§13).
 *
 * Ne connaît RIEN de la séance, de la performance ni de l'écran : c'est ce
 * qui le rend testable en Node, comme session-metrics.ts.
 */

/**
 * Un round par minute -- c'est ce que dit le nom.
 *
 * L'intervalle STANDARD, pas le seul possible : un entraînement en garde le
 * sien (`PlannedExercise.intervalSeconds`), et `emomStatus` accepte n'importe
 * quelle valeur. C'est ce que proposent les écrans, réuni ici pour que la
 * séance libre et la création d'un entraînement ne puissent pas diverger.
 */
export const EMOM_INTERVAL_SECONDS = 60;

export type EmomStatus = {
  /** Le round en cours, 1-indexé. */
  round: number;
  /** Ce qu'il reste au round en cours, jamais négatif. */
  remainingSeconds: number;
  /** Le round en cours a dépassé sa fenêtre : il faut passer au suivant. */
  roundElapsed: boolean;
  /** Tous les rounds sont épuisés : rien ne reprend derrière. */
  done: boolean;
};

export function emomStatus(input: {
  intervalSeconds: number;
  totalRounds: number;
  round: number;
  roundStartedAt: Date;
  now: Date;
}): EmomStatus {
  const elapsed = Math.max(0, Math.floor((input.now.getTime() - input.roundStartedAt.getTime()) / 1000));
  const remainingSeconds = Math.max(0, input.intervalSeconds - elapsed);

  return {
    round: input.round,
    remainingSeconds,
    roundElapsed: elapsed >= input.intervalSeconds,
    done: input.round >= input.totalRounds && elapsed >= input.intervalSeconds,
  };
}
