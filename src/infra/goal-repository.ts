import {
  Goal,
  type Condition,
  type GoalStatus,
  type Metric,
  type Operator,
  type ProgressionStep,
  type Requirement,
} from '../domain/goal/goal';
import { getDatabase } from './db';

type GoalRow = { id: string; name: string; current_step: number; status: GoalStatus };
type StepRow = { goal_id: string; position: number; exercise_id: string };
type ConditionRow = {
  goal_id: string;
  position: number;
  requirement_index: number;
  metric_type: Metric['type'];
  measurement_id: string | null;
  operator: Operator;
  value: number;
};

export async function save(goal: Goal): Promise<void> {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO goals (id, name, current_step, status) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name, current_step = excluded.current_step, status = excluded.status;`,
      goal.id,
      goal.name,
      goal.currentStepIndex,
      goal.status,
    );

    await db.runAsync('DELETE FROM goal_steps WHERE goal_id = ?;', goal.id);

    for (const [position, step] of goal.steps.entries()) {
      await db.runAsync(
        'INSERT INTO goal_steps (goal_id, position, exercise_id) VALUES (?, ?, ?);',
        goal.id,
        position,
        step.exerciseId,
      );

      for (const [requirementIndex, requirement] of step.requirements.entries()) {
        for (const [conditionIndex, condition] of requirement.conditions.entries()) {
          await db.runAsync(
            `INSERT INTO goal_conditions
               (goal_id, position, requirement_index, condition_index,
                metric_type, measurement_id, operator, value)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
            goal.id,
            position,
            requirementIndex,
            conditionIndex,
            condition.metric.type,
            condition.metric.type === 'setCount' ? null : condition.metric.measurementId,
            condition.operator,
            condition.value,
          );
        }
      }
    }
  });
}

export async function findAll(): Promise<Goal[]> {
  const db = await getDatabase();

  const goals = await db.getAllAsync<GoalRow>('SELECT * FROM goals ORDER BY name;');
  const stepRows = await db.getAllAsync<StepRow>(
    'SELECT * FROM goal_steps ORDER BY goal_id, position;',
  );
  const conditionRows = await db.getAllAsync<ConditionRow>(
    `SELECT * FROM goal_conditions
     ORDER BY goal_id, position, requirement_index, condition_index;`,
  );

  // Les conditions sont regroupées par étape, puis par requirement.
  const conditionsOf = new Map<string, Map<number, Condition[]>>();
  for (const row of conditionRows) {
    const stepKey = `${row.goal_id}|${row.position}`;
    const requirements = conditionsOf.get(stepKey) ?? new Map<number, Condition[]>();
    const conditions = requirements.get(row.requirement_index) ?? [];
    conditions.push({
      metric:
        row.metric_type === 'setCount'
          ? { type: 'setCount' }
          : { type: row.metric_type, measurementId: row.measurement_id! },
      operator: row.operator,
      value: row.value,
    });
    requirements.set(row.requirement_index, conditions);
    conditionsOf.set(stepKey, requirements);
  }

  const stepsOf = new Map<string, ProgressionStep[]>();
  for (const row of stepRows) {
    const requirements: Requirement[] = [
      ...(conditionsOf.get(`${row.goal_id}|${row.position}`) ?? new Map()),
    ]
      .sort(([a], [b]) => a - b)
      .map(([, conditions]) => ({ conditions }));

    const list = stepsOf.get(row.goal_id) ?? [];
    list.push({ exerciseId: row.exercise_id, requirements });
    stepsOf.set(row.goal_id, list);
  }

  return goals.map((row) =>
    Goal.restore({
      id: row.id,
      name: row.name,
      steps: stepsOf.get(row.id) ?? [],
      currentStep: row.current_step,
      status: row.status,
    }),
  );
}
