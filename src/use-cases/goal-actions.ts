import { randomUUID } from 'expo-crypto';
import {
  evaluateRequirements,
  windowsUsedBy,
  type RequirementEvaluation,
} from '../domain/goal/evaluation';
import {
  Goal,
  windowsFor,
  type GoalSubject,
  type GoalTarget,
  type Requirement,
} from '../domain/goal/goal';
import { evaluationWindow } from './preferences';
import { loadSamplesForWindows } from '../infra/evaluation-source';
import { findAll, save } from '../infra/goal-repository';

/** CreateGoal (§25). */
export async function createGoal(input: { name: string; target: GoalTarget }): Promise<Goal> {
  const goal = Goal.create({ id: randomUUID(), ...input });
  await save(goal);
  return goal;
}

export type GoalEvaluation = RequirementEvaluation;

/**
 * EvaluateGoal (§25).
 *
 * Le use case ne juge rien : il regarde quelles FENÊTRES les conditions
 * réclament, va chercher les séries correspondantes, et remet le tout au
 * domaine. Deux conditions d'une même exigence peuvent ainsi porter sur des
 * périodes différentes -- la forme du jour d'un côté, le volume accumulé de
 * l'autre.
 */
export async function evaluateGoal(goal: Goal): Promise<GoalEvaluation | null> {
  // Une étape sans requirement n'est pas évaluable : elle se valide à la main.
  if (goal.currentRequirements.length === 0) return null;

  const requirements = await onPreferredWindow(goal.currentRequirements, goal.currentSubject);
  const samples = await loadSamplesForWindows(goal.currentSubject, windowsUsedBy(requirements));
  return evaluateRequirements(requirements, samples);
}

/**
 * Les mêmes exigences, ramenées à la période que l'utilisateur a choisie.
 *
 * Le modèle laisse chaque condition porter la sienne ; l'application, elle,
 * n'en veut qu'une pour tous ses objectifs (voir `preferences`). La condition
 * STOCKÉE n'est pas touchée : c'est l'évaluation du moment qu'on ramène, et
 * basculer le réglage suffit donc à tout réévaluer.
 *
 * Une mensuration garde la sienne : elle n'a pas de séances, seulement des
 * relevés -- lui imposer « dernière séance » n'aurait aucun sens.
 */
async function onPreferredWindow(
  requirements: readonly Requirement[],
  subject: GoalSubject,
): Promise<readonly Requirement[]> {
  const allowed = windowsFor(subject);
  const preferred = await evaluationWindow();
  if (!allowed.includes(preferred)) return requirements;

  return requirements.map((requirement) => ({
    conditions: requirement.conditions.map((condition) => ({ ...condition, window: preferred })),
  }));
}

/** Un objectif dont l'étape en cours vient d'être satisfaite. */
export type ReachedGoal = { readonly goal: Goal; readonly evaluation: GoalEvaluation };

/**
 * Les objectifs que ce qu'on vient de faire met à portée.
 *
 * Seuls ceux qui visent un exercice TRAVAILLÉ : annoncer les autres serait
 * annoncer une réussite sans rapport avec la séance qu'on termine -- elle
 * était déjà acquise avant d'entrer dans la salle.
 *
 * Rien n'est décidé ici : franchir une étape reste un choix (n°17), et cette
 * fonction ne fait que dire lesquels sont mûrs.
 */
export async function goalsReachedBy(
  exerciseIds: readonly string[],
): Promise<ReachedGoal[]> {
  const concerned = (await findAll()).filter((goal) => {
    const subject = goal.currentSubject;
    return (
      goal.status === 'ACTIVE' &&
      subject.kind === 'exercise' &&
      exerciseIds.includes(subject.exerciseId)
    );
  });

  const evaluations = await Promise.all(concerned.map((goal) => evaluateGoal(goal)));

  return concerned.flatMap((goal, index) => {
    const evaluation = evaluations[index];
    // Une étape sans condition ne s'atteint pas toute seule : elle se valide
    // à la main, et n'a donc rien à annoncer.
    return evaluation?.satisfied ? [{ goal, evaluation }] : [];
  });
}

/** AdvanceProgression (§25) : l'utilisateur accepte de passer à l'étape suivante. */
export async function advanceProgression(goal: Goal): Promise<Goal> {
  goal.advance();
  await save(goal);
  return goal;
}

export async function archiveGoal(goal: Goal): Promise<Goal> {
  goal.archive();
  await save(goal);
  return goal;
}

export const listGoals = findAll;
