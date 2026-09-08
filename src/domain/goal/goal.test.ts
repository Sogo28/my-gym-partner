import { describe, expect, it } from 'vitest';
import { Goal, type Condition, type ProgressionStep } from './goal';

const hold10: Condition = {
  measurementId: 'duration',
  window: 'LAST_SESSION',
  aggregation: 'average',
  operator: '>=',
  target: 10,
};

const step = (exerciseId: string): ProgressionStep => ({
  subject: { kind: 'exercise', exerciseId },
  requirements: [{ conditions: [hold10] }],
});

const frontLever = () =>
  Goal.create({
    id: 'goal-1',
    name: 'Front Lever',
    target: { kind: 'progressive', steps: [step('tuck'), step('advanced-tuck'), step('straddle')] },
  });

const simple = () =>
  Goal.create({
    id: 'goal-2',
    name: 'Tenir 10 secondes',
    target: {
      kind: 'simple',
      subject: { kind: 'exercise', exerciseId: 'advanced-tuck' },
      requirements: [{ conditions: [hold10] }],
    },
  });

describe('Goal simple', () => {
  it('vise directement un exercice, sans étape fabriquée', () => {
    const goal = simple();

    expect(goal.isProgressive).toBe(false);
    expect(goal.steps).toHaveLength(0);
    expect(goal.currentSubject).toEqual({ kind: 'exercise', exerciseId: 'advanced-tuck' });
    expect(goal.currentRequirements[0].conditions).toEqual([hold10]);
  });

  it('est toujours sur sa cible unique, et ne peut pas avancer', () => {
    const goal = simple();

    expect(goal.isOnLastStep).toBe(true);
    expect(() => goal.advance()).toThrow(/pas d'étapes/);
  });
});

describe('Goal progressif', () => {
  it('commence à sa première étape', () => {
    const goal = frontLever();

    expect(goal.currentStepIndex).toBe(0);
    expect(goal.currentSubject).toEqual({ kind: 'exercise', exerciseId: 'tuck' });
  });

  it('avance d une étape sur décision de l utilisateur', () => {
    const goal = frontLever();

    goal.advance();

    expect(goal.currentSubject).toEqual({ kind: 'exercise', exerciseId: 'advanced-tuck' });
  });

  it('refuse d avancer au-delà de la dernière étape', () => {
    const goal = frontLever();
    goal.advance();
    goal.advance();

    expect(goal.isOnLastStep).toBe(true);
    expect(() => goal.advance()).toThrow(/dernière étape/);
  });

  it('accepte une étape sans requirement : elle ne sera pas évaluée', () => {
    const goal = Goal.create({
      id: 'g',
      name: 'Libre',
      target: {
        kind: 'progressive',
        steps: [{ subject: { kind: 'exercise', exerciseId: 'tuck' }, requirements: [] }],
      },
    });

    expect(goal.currentRequirements).toHaveLength(0);
  });

  it('accepte plusieurs requirements sur une étape', () => {
    const goal = Goal.create({
      id: 'g',
      name: 'Exigeant',
      target: {
        kind: 'progressive',
        steps: [
          {
            subject: { kind: 'exercise', exerciseId: 'tuck' },
            requirements: [{ conditions: [hold10] }, { conditions: [hold10] }],
          },
        ],
      },
    });

    expect(goal.currentRequirements).toHaveLength(2);
  });

  it('refuse une progression sans étape', () => {
    expect(() =>
      Goal.create({ id: 'g', name: 'Vide', target: { kind: 'progressive', steps: [] } }),
    ).toThrow(/au moins une étape/);
  });
});

describe('Goal', () => {
  it('refuse d avancer un objectif archivé', () => {
    const goal = frontLever();
    goal.archive();

    expect(goal.status).toBe('ARCHIVED');
    expect(() => goal.advance()).toThrow(/archivé/);
  });

  it('laisse modifier la règle d évaluation sans toucher aux performances', () => {
    const goal = simple();

    goal.changeTarget({
      kind: 'simple',
      subject: { kind: 'exercise', exerciseId: 'advanced-tuck' },
      requirements: [{ conditions: [{ ...hold10, target: 12 }] }],
    });

    expect(goal.currentRequirements[0].conditions[0].target).toBe(12);
  });

  it('refuse un requirement sans condition', () => {
    expect(() =>
      Goal.create({
        id: 'g',
        name: 'X',
        target: {
          kind: 'simple',
          subject: { kind: 'exercise', exerciseId: 'e' },
          requirements: [{ conditions: [] }],
        },
      }),
    ).toThrow(/jamais être évalué/);
  });

  it('refuse une condition sans mesure quand elle en observe une', () => {
    expect(() =>
      Goal.create({
        id: 'g',
        name: 'X',
        target: {
          kind: 'simple',
          subject: { kind: 'exercise', exerciseId: 'e' },
          requirements: [{ conditions: [{ ...hold10, measurementId: null }] }],
        },
      }),
    ).toThrow(/préciser la mesure/);
  });

  it('refuse un nom vide', () => {
    expect(() =>
      Goal.create({ id: 'g', name: '  ', target: { kind: 'progressive', steps: [step('tuck')] } }),
    ).toThrow();
  });
});

describe('les clauses d une condition', () => {
  const exercise = { kind: 'exercise' as const, exerciseId: 'bench' };

  const withQualifying = (over: Partial<Condition>, subject = exercise) =>
    Goal.create({
      id: 'g',
      name: 'Développé',
      target: {
        kind: 'simple',
        subject,
        requirements: [
          {
            conditions: [
              {
                measurementId: null,
                window: subject.kind === 'exercise' ? 'LAST_SESSION' : 'LATEST_READING',
                aggregation: 'setCount',
                operator: '>=',
                target: 1,
                qualifying: [
                  { measurementId: 'reps', operator: '>=', target: 10 },
                  { measurementId: 'weight', operator: '>=', target: 60 },
                ],
                ...over,
              },
            ],
          },
        ],
      },
    });

  it('accepte un décompte qui décrit les séries qu il compte', () => {
    expect(() => withQualifying({})).not.toThrow();
  });

  // Une moyenne réduit une colonne de valeurs : elle ne sait pas ce qu'une
  // série valait ailleurs, donc elle ne peut pas la décrire.
  it('refuse des clauses sur autre chose qu un décompte de séries', () => {
    expect(() => withQualifying({ aggregation: 'average', measurementId: 'reps' })).toThrow(
      /décompte de séries/,
    );
  });

  it('refuse la même mesure exigée deux fois', () => {
    expect(() =>
      withQualifying({
        qualifying: [
          { measurementId: 'reps', operator: '>=', target: 10 },
          { measurementId: 'reps', operator: '<=', target: 20 },
        ],
      }),
    ).toThrow(/deux fois/);
  });

  it('refuse de décrire une série sur un relevé corporel', () => {
    expect(() => withQualifying({}, { kind: 'body', metricId: 'cuisse' } as never)).toThrow(
      /n est pas une série/,
    );
  });
});
