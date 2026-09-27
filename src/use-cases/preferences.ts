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
 * Pas un réglage : c'est un garde-fou contre l'oubli, pas une contrainte sur
 * la série. Deux minutes couvrent large -- le temps de reculer, de faire une
 * série longue et de revenir -- sans qu'un enregistrement laissé ouvert
 * remplisse le téléphone.
 */
export const CAPTURE_MAX_SECONDS = 120;

/**
 * Le décompte de MISE EN PLACE avant le premier round d'un EMOM (décidé le
 * 2026-09-27).
 *
 * Même raison que le décompte de captation -- la distance entre le téléphone
 * et soi --, et pourtant un réglage à part, parce que ce n'est pas le même
 * trajet. Rejoindre une barre prend cinq secondes ; poser le téléphone,
 * marcher au mur et monter en équilibre en prend dix ou quinze. Les réunir
 * aurait obligé à choisir le plus long des deux pour les deux.
 *
 * Il ne vaut que pour le PREMIER round : les suivants s'enchaînent alors
 * qu'on est déjà sur place.
 */
const SETUP_KEY = 'emom.setup';

/** En secondes. Zéro : le premier round part au tap, comme avant. */
export const SETUP_CHOICES = [0, 5, 10, 15] as const;

const SETUP_FALLBACK = 10;

export async function emomSetupCountdown(): Promise<number> {
  const stored = Number(await readSetting(SETUP_KEY));
  return SETUP_CHOICES.includes(stored as never) ? stored : SETUP_FALLBACK;
}

export async function setEmomSetupCountdown(seconds: number): Promise<void> {
  await writeSetting(SETUP_KEY, String(seconds));
}
