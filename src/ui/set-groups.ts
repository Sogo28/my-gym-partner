/**
 * Les séries identiques qui se suivent, comptées ensemble.
 *
 * « 4 × 8 reps » est ce qu'on écrit sur un carnet ; quatre lignes identiques
 * sont ce que le modèle enregistre. Le regroupement est donc un fait
 * d'AFFICHAGE : un entraînement reste une liste ordonnée de séries, chacune
 * pouvant être corrigée séparément une fois le groupe éclaté.
 *
 * Seules les séries CONSÉCUTIVES se regroupent : 10, 10, 8, 10 décrit une
 * progression, pas trois séries à 10 suivies d'une à 8.
 */
export type TargetedSet = { readonly targets: Readonly<Record<string, number>> };

export type SetGroup = {
  readonly targets: Readonly<Record<string, number>>;
  readonly count: number;
  /** Le rang de la première série du groupe dans la liste d'origine. */
  readonly from: number;
};

export function groupConsecutive(sets: readonly TargetedSet[]): SetGroup[] {
  const groups: SetGroup[] = [];

  sets.forEach((set, index) => {
    const last = groups[groups.length - 1];
    if (last && sameTargets(last.targets, set.targets)) {
      groups[groups.length - 1] = { ...last, count: last.count + 1 };
      return;
    }
    groups.push({ targets: set.targets, count: 1, from: index });
  });

  return groups;
}

function sameTargets(
  a: Readonly<Record<string, number>>,
  b: Readonly<Record<string, number>>,
): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => a[key] === b[key]);
}
