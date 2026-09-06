import { randomUUID } from 'expo-crypto';
import {
  evaluateRequirements,
  windowsUsedBy,
  type RequirementEvaluation,
} from '../domain/goal/evaluation';
import { Goal, type GoalTarget } from '../domain/goal/goal';
import { loadSetsForWindows } from '../infra/evaluation-source';
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
  const requirements = goal.currentRequirements;
  if (requirements.length === 0) return null;

  const sets = await loadSetsForWindows(goal.currentExerciseId, windowsUsedBy(requirements));
  return evaluateRequirements(requirements, sets);
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
