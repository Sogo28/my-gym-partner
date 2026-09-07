/**
 * La hauteur de chaque barre, en pourcentage de la plus haute.
 *
 * Pur, et dans son propre fichier : c'est le seul calcul du graphe, donc le
 * seul endroit où il peut se tromper -- autant qu'il soit vérifiable sans
 * rendu ni émulateur.
 */
export function barHeights(values: readonly number[]): number[] {
  if (values.length === 0) return [];

  const max = Math.max(...values);
  const min = Math.min(...values);

  /**
   * La base n'est pas zéro : entre 40 s et 45 s, des barres parties de zéro
   * se ressemblent toutes. On garde un quart de l'écart sous la plus basse,
   * pour que la plus faible reste visible sans écraser les autres.
   */
  const floor = min - (max - min) * 0.25;

  // Toutes les valeurs égales -- un poids jamais changé, un zéro partout :
  // il n'y a plus d'échelle à calculer, et diviser par l'écart donnerait NaN,
  // donc des barres sans hauteur. Un plateau se dessine à plat, en haut.
  if (max === floor) return values.map(() => 100);

  return values.map((value) => Math.max(6, ((value - floor) / (max - floor)) * 100));
}
