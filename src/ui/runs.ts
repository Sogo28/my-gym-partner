/** Une suite d'éléments identiques qui se suivent : le premier, et combien. */
export type Run<T> = {
  /** La place du premier élément de la suite, à partir de zéro. */
  readonly start: number;
  readonly count: number;
  readonly item: T;
};

/**
 * Regroupe les éléments IDENTIQUES QUI SE SUIVENT (décidé le 2026-10-08) :
 * cinq séries de « 12 × 20 kg » se lisent en une ligne « × 5 », plutôt
 * qu'en cinq lignes qui disent la même chose.
 *
 * Seulement ceux qui se suivent : une série différente au milieu coupe la
 * suite, l'ordre de la séance reste lisible. `keyOf` dit ce qui rend deux
 * éléments identiques ; une clé `null` garde l'élément seul -- une série
 * filmée, dont la vidéo ne se fond pas dans un groupe.
 */
export function runsBy<T>(items: readonly T[], keyOf: (item: T) => string | null): Run<T>[] {
  const runs: Run<T>[] = [];
  let lastKey: string | null = null;

  items.forEach((item, index) => {
    const key = keyOf(item);
    const last = runs.at(-1);
    if (last && key !== null && key === lastKey) {
      runs[runs.length - 1] = { ...last, count: last.count + 1 };
    } else {
      runs.push({ start: index, count: 1, item });
    }
    lastKey = key;
  });

  return runs;
}
