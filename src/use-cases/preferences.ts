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

/**
 * Le décompte avant qu'une captation ne démarre (décidé le 2026-09-12).
 *
 * Il existe pour une raison précise : on s'entraîne seul. Sans lui, il
 * faudrait lancer l'enregistrement, marcher jusqu'à la barre, faire la série,
 * revenir couper -- et la vidéo montrerait surtout le trajet.
 *
 * Réglé globalement parce qu'il dépend de la salle, pas de l'exercice : c'est
 * la distance entre le téléphone et la barre qui décide, et elle ne change
 * pas d'une série à l'autre.
 */
const COUNTDOWN_KEY = 'capture.countdown';

/** En secondes. Zéro : le départ est immédiat. */
export const COUNTDOWN_CHOICES = [0, 3, 5, 10] as const;

const COUNTDOWN_FALLBACK = 5;

export async function captureCountdown(): Promise<number> {
  const stored = Number(await readSetting(COUNTDOWN_KEY));
  return COUNTDOWN_CHOICES.includes(stored as never) ? stored : COUNTDOWN_FALLBACK;
}

export async function setCaptureCountdown(seconds: number): Promise<void> {
  await writeSetting(COUNTDOWN_KEY, String(seconds));
}

/**
 * La durée maximale d'une captation, en secondes.
 *
 * Pas un réglage : c'est un garde-fou. Une série dure une minute au plus, et
 * trente secondes de vidéo pèsent déjà des dizaines de mégaoctets -- sans
 * borne, un oubli remplirait le téléphone.
 */
export const CAPTURE_MAX_SECONDS = 60;
