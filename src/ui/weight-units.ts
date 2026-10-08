/**
 * Les livres, pour la saisie seulement (décidé le 2026-10-08).
 *
 * Certaines salles n'ont que des disques en livres : on doit pouvoir dire
 * « 45 lbs » sans convertir de tête. Mais tout reste ENREGISTRÉ et affiché en
 * kilos -- un record, un objectif, une courbe ne comparent que des valeurs de
 * la même unité, et en mêler deux les rendrait faux sans que rien ne le dise.
 */
export const KG_PER_LB = 0.45359237;

/** Le pas des livres : le plus petit disque courant, 2,5 lbs. */
export const LB_STEP = 2.5;

/** Le plafond de la roulette en livres, l'équivalent des 400 kg. */
export const LB_CEILING = 900;

/** Des livres vers les kilos enregistrés, au dixième : 45 lbs → 20,4 kg. */
export function lbToKg(pounds: number): number {
  return Math.round(pounds * KG_PER_LB * 10) / 10;
}

/**
 * Des kilos enregistrés vers le cran de livres le plus proche.
 *
 * Arrondi au PAS, et non au dixième : 20,4 kg doivent se relire 45 lbs, la
 * charge qu'on a posée, et non 44,97 -- que la roulette ne propose pas.
 */
export function kgToLb(kilograms: number): number {
  return Math.round(kilograms / KG_PER_LB / LB_STEP) * LB_STEP;
}
