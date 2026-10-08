import { useEffect, useRef, useState } from 'react';

/**
 * L'heure, rafraîchie tous les `intervalMs` -- pour CE composant seulement.
 *
 * Le battement vivait dans l'écran de séance, qui se redessinait en entier
 * chaque seconde (quatre fois pendant un EMOM) pour faire avancer un chiffre.
 * Deux mille lignes recalculées pour un chrono : la roulette mettait deux
 * secondes à retenir une valeur, et pouvait perdre son geste. Désormais, seul
 * le chiffre qui change se redessine (décidé le 2026-10-08).
 */
export function useNow(intervalMs: number, active = true): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, active]);

  return now;
}

/**
 * Appelle `onReached` à l'instant `at` (en millisecondes), une fois -- tout de
 * suite si l'instant est déjà passé.
 *
 * Un minuteur réglé sur l'heure exacte, au lieu d'un battement qui vérifie
 * à chaque tour si l'heure est venue : rien ne se redessine en attendant.
 * Sans instant (`null`), rien n'est programmé.
 */
export function useAt(at: number | null, onReached: () => void): void {
  const callback = useRef(onReached);
  callback.current = onReached;

  useEffect(() => {
    if (at === null) return;
    const timer = setTimeout(() => callback.current(), Math.max(0, at - Date.now()));
    return () => clearTimeout(timer);
  }, [at]);
}

/**
 * Les `count` dernières secondes avant `deadline`, une par une : `onSecond`
 * reçoit le nombre de secondes qui restent (5, 4, 3, 2, 1). Le zéro n'est
 * pas compris -- c'est le départ, qui a son propre signal.
 *
 * Les secondes déjà passées ne sont pas rattrapées : revenir sur l'écran à
 * deux secondes de la fin ne fait pas sonner les trois précédentes d'un coup.
 */
export function useLastSeconds(
  deadline: number | null,
  onSecond: (left: number) => void,
  count = 5,
): void {
  const callback = useRef(onSecond);
  callback.current = onSecond;

  useEffect(() => {
    if (deadline === null) return;
    const now = Date.now();
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let left = count; left >= 1; left -= 1) {
      const at = deadline - left * 1000;
      if (at < now - 50) continue;
      timers.push(setTimeout(() => callback.current(left), Math.max(0, at - now)));
    }
    return () => timers.forEach(clearTimeout);
  }, [deadline, count]);
}
