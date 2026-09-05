import {
  Goal,
  type Aggregation,
  type Condition,
  type EvaluationWindow,
  type GoalStatus,
  type GoalTarget,
  type Operator,
  type ProgressionStep,
} from '../domain/goal/goal';
import { getDatabase } from './db';

/** Le requirement de l'objectif lui-même, quand il n'a pas d'étapes. */
const GOAL_ITSELF = -1;

type GoalRow = {
  id: string;
  name: string;
  kind: 'simple' | 'progressive';
  exercise_id: string | null;
  current_step: number;
  status: GoalStatus;
};
type StepRow = { goal_id: string; position: number; exercise_id: string };
type ConditionRow = {
  goal_id: string;
  step_position: number;
  measurement_id: string | null;
  window: EvaluationWindow;
  aggregation: Aggregation;
  operator: Operator;
  target: number;
};

export async function save(goal: Goal): Promise<void> {
  const db = await getDatabase();
  const target = goal.target;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO goals (id, name, kind, exercise_id, current_step, status)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name, kind = excluded.kind, exercise_id = excluded.exercise_id,
         current_step = excluded.current_step, status = excluded.status;`,
      goal.id,
      goal.name,
      target.kind,
      target.kind === 'simple' ? target.exerciseId : null,
      goal.currentStepIndex,
      goal.status,
    );

    await db.runAsync('DELETE FROM goal_steps WHERE goal_id = ?;', goal.id);
    await db.runAsync('DELETE FROM goal_conditions WHERE goal_id = ?;', goal.id);

    if (target.kind === 'simple') {
      await saveConditions(db, goal.id, GOAL_ITSELF, target.requirement.conditions);
      return;
    }

    for (const [position, step] of target.steps.entries()) {
      await db.runAsync(
        'INSERT INTO goal_steps (goal_id, position, exercise_id) VALUES (?, ?, ?);',
        goal.id,
        position,
        step.exerciseId,
      );
      if (step.requirement) {
        await saveConditions(db, goal.id, position, step.requirement.conditions);
      }
    }
  });
}

async function saveConditions(
  db: Awaited<ReturnType<typeof getDatabase>>,
  goalId: string,
  stepPosition: number,
  conditions: readonly Condition[],
): Promise<void> {
  for (const [index, condition] of conditions.entries()) {
    await db.runAsync(
      `INSERT INTO goal_conditions
         (goal_id, step_position, condition_index, measurement_id, window, aggregation, operator, target)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      goalId,
      stepPosition,
      index,
      condition.measurementId,
      condition.window,
      condition.aggregation,
      condition.operator,
      condition.target,
    );
  }
}

export async function findAll(): Promise<Goal[]> {
  const db = await getDatabase();

  const goals = await db.getAllAsync<GoalRow>('SELECT * FROM goals ORDER BY name;');
  const stepRows = await db.getAllAsync<StepRow>(
    'SELECT * FROM goal_steps ORDER BY goal_id, position;',
  );
  const conditionRows = await db.getAllAsync<ConditionRow>(
    'SELECT * FROM goal_conditions ORDER BY goal_id, step_position, condition_index;',
  );

  const conditionsOf = new Map<string, Condition[]>();
  for (const row of conditionRows) {
    const key = `${row.goal_id}|${row.step_position}`;
    const list = conditionsOf.get(key) ?? [];
    list.push({
      measurementId: row.measurement_id,
      window: row.window,
      aggregation: row.aggregation,
      operator: row.operator,
      target: row.target,
    });
    conditionsOf.set(key, list);
  }

  const stepsOf = new Map<string, ProgressionStep[]>();
  for (const row of stepRows) {
    const conditions = conditionsOf.get(`${row.goal_id}|${row.position}`);
    const list = stepsOf.get(row.goal_id) ?? [];
    list.push({
      exerciseId: row.exercise_id,
      requirement: conditions ? { conditions } : null,
    });
    stepsOf.set(row.goal_id, list);
  }

  return goals.map((row) => {
    const target: GoalTarget =
      row.kind === 'simple'
        ? {
            kind: 'simple',
            exerciseId: row.exercise_id!,
            requirement: { conditions: conditionsOf.get(`${row.id}|${GOAL_ITSELF}`) ?? [] },
          }
        : { kind: 'progressive', steps: stepsOf.get(row.id) ?? [] };

    return Goal.restore({
      id: row.id,
      name: row.name,
      target,
      currentStep: row.current_step,
      status: row.status,
    });
  });
}
