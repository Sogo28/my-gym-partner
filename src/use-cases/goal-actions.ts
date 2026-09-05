import { randomUUID } from 'expo-crypto';
import { evaluateStep, type StepEvaluation } from '../domain/goal/evaluation';
import { Goal, type ProgressionStep } from '../domain/goal/goal';
import { findAll, save } from '../infra/goal-repository';
import { findLatestCompletedFor } from '../infra/performance-repository';

/** CreateGoal (§25). */
export async function createGoal(input: {
  name: string;
  steps: readonly ProgressionStep[];
}): Promise<Goal> {
  const goal = Goal.create({ id: randomUUID(), ...input });
  await save(goal);
  return goal;
}

export type GoalEvaluation = StepEvaluation & {
  /** Aucune performance enregistrée pour l'exercice de l'étape courante. */
  readonly hasData: boolean;
};

/**
 * EvaluateGoal (§25).
 *
 * En V1, l'évaluation porte sur la DERNIÈRE séance pertinente (n°30) : celle
 * où l'exercice de l'étape courante a été réellement travaillé. Pas de
 * moyenne glissante sur plusieurs séances -- c'est une décision gelée, et
 * elle rend le résultat lisible : "ta dernière séance a donné 8 secondes".
 *
 * Le use case ne fait que rassembler les séries ; c'est le domaine qui juge.
 */
export async function evaluateGoal(goal: Goal): Promise<GoalEvaluation> {
  const performance = await findLatestCompletedFor(goal.currentStep.exerciseId);
  const evaluation = evaluateStep(goal.currentStep, performance?.sets ?? []);
  return { ...evaluation, hasData: performance !== null };
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
