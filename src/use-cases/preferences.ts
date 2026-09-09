import type { EvaluationWindow } from '../domain/goal/goal';
import { readSetting, writeSetting } from '../infra/settings-repository';

/**
 * Sur quoi les objectifs sont évalués (décidé le 2026-09-09).
 *
 * Le modèle attache la période à CHAQUE condition (§6), ce qui permet à une
 * même exigence de mêler la forme du jour et le volume accumulé. À l'usage,
 * ce mélange n'a jamais servi : on veut savoir si on tient l'exercice
 * AUJOURD'HUI, pour tous ses objectifs à la fois.
 *
 * L'application tranche donc globalement, et le fait tout de suite : basculer
 * ce réglage réévalue tout l'existant. Un réglage qui ne vaudrait que pour
 * les objectifs à venir aurait l'air cassé.
 *
 * La période reste dans le modèle : c'est le domaine qui décrit ce qu'on peut
 * exprimer, l'application qui décide ce qu'elle en demande.
 */
const KEY = 'goals.window';

/** Par défaut la dernière séance : un objectif dit où l'on en est. */
const FALLBACK: EvaluationWindow = 'LAST_SESSION';

/** Les périodes qu'un exercice sait alimenter, donc les seules à proposer. */
export const SELECTABLE_WINDOWS: readonly EvaluationWindow[] = ['LAST_SESSION', 'ALL_TIME'];

export async function evaluationWindow(): Promise<EvaluationWindow> {
  const stored = await readSetting(KEY);
  return SELECTABLE_WINDOWS.includes(stored as EvaluationWindow)
    ? (stored as EvaluationWindow)
    : FALLBACK;
}

export async function setEvaluationWindow(window: EvaluationWindow): Promise<void> {
  await writeSetting(KEY, window);
}
