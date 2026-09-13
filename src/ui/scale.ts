/**
 * L'échelle verticale d'un graphe : entre quoi et quoi il se lit.
 *
 * Pure, et dans son propre fichier : c'est le seul calcul du graphe, donc le
 * seul endroit où il peut se tromper -- autant qu'il soit vérifiable sans
 * rendu ni émulateur.
 */
export type Scale = { readonly floor: number; readonly max: number };

export function chartScale(values: readonly number[]): Scale {
  const max = Math.max(...values);
  const min = Math.min(...values);

  /**
   * La base n'est pas zéro : entre 40 s et 45 s, une courbe partie de zéro
   * serait plate. On garde un quart de l'écart sous la plus basse, pour que
   * la plus faible reste visible sans écraser les autres.
   *
   * Le mensonge qu'une base tronquée fait courir est désamorcé par les
   * graduations : elles portent les nombres réels, et l'on voit d'où part
   * l'échelle.
   *
   * Elle ne descend jamais sous zéro quand les valeurs n'y descendent pas :
   * un volume de moins deux, un poids négatif, une durée qui recule -- la
   * graduation annoncerait une grandeur qui n'existe pas.
   */
  const floor = min - (max - min) * 0.25;
  return { floor: min >= 0 ? Math.max(floor, 0) : floor, max };
}

/**
 * La place de chaque valeur sur l'échelle, en pourcentage DEPUIS LE HAUT.
 *
 * Depuis le haut parce qu'un repère de dessin a son origine en haut à gauche.
 */
export function curveOffsets(values: readonly number[]): number[] {
  if (values.length === 0) return [];

  const { floor, max } = chartScale(values);

  // Toutes les valeurs égales -- un poids jamais changé, un zéro partout :
  // il n'y a plus d'échelle à calculer, et diviser par l'écart donnerait NaN.
  // Un plateau se dessine à plat, au milieu, où il ne prétend être ni un
  // sommet ni un creux.
  if (max === floor) return values.map(() => 50);

  return values.map((value) => 100 - ((value - floor) / (max - floor)) * 100);
}
