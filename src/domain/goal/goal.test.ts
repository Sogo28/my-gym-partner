import { describe, expect, it } from 'vitest';
import { Goal, type ProgressionStep } from './goal';

const step = (exerciseId: string): ProgressionStep => ({
  exerciseId,
  requirements: [
    { conditions: [{ metric: { type: 'average', measurementId: 'duration' }, operator: '>=', value: 10 }] },
  ],
});

const frontLever = () =>
  Goal.create({
    id: 'goal-1',
    name: 'Front Lever',
    steps: [step('tuck'), step('advanced-tuck'), step('straddle')],
  });

describe('Goal', () => {
  it('commence à sa première étape', () => {
    const goal = frontLever();

    expect(goal.currentStepIndex).toBe(0);
    expect(goal.currentStep.exerciseId).toBe('tuck');
    expect(goal.status).toBe('ACTIVE');
  });

  it('avance d une étape à la fois, sur décision de l utilisateur', () => {
    const goal = frontLever();

    goal.advance();

    expect(goal.currentStep.exerciseId).toBe('advanced-tuck');
  });

  it('refuse d avancer au-delà de la dernière étape', () => {
    const goal = frontLever();
    goal.advance();
    goal.advance();

    expect(goal.isOnLastStep).toBe(true);
    expect(() => goal.advance()).toThrow(/dernière étape/);
  });

  it('refuse d avancer un objectif archivé', () => {
    const goal = frontLever();
    goal.archive();

    expect(goal.status).toBe('ARCHIVED');
    expect(() => goal.advance()).toThrow(/archivé/);
  });

  it('accepte un objectif simple, à une seule étape', () => {
    const goal = Goal.create({ id: 'g', name: 'Tenir 10s', steps: [step('front-lever')] });

    expect(goal.isOnLastStep).toBe(true);
  });

  it('refuse un objectif sans étape, ou une étape sans condition', () => {
    expect(() => Goal.create({ id: 'g', name: 'Vide', steps: [] })).toThrow(/au moins une étape/);
    expect(() =>
      Goal.create({ id: 'g', name: 'X', steps: [{ exerciseId: 'e', requirements: [] }] }),
    ).toThrow(/au moins une condition/);
    expect(() =>
      Goal.create({
        id: 'g',
        name: 'X',
        steps: [{ exerciseId: 'e', requirements: [{ conditions: [] }] }],
      }),
    ).toThrow(/jamais être évalué/);
  });

  it('refuse un nom vide', () => {
    expect(() => Goal.create({ id: 'g', name: '  ', steps: [step('tuck')] })).toThrow();
  });
});
