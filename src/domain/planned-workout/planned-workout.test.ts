import { describe, expect, it } from 'vitest';
import { PlannedWorkout, type PlannedExercise } from './planned-workout';

const emptyWorkout = () => PlannedWorkout.create({ id: 'pw-1', name: 'Pull day' });

describe('PlannedWorkout', () => {
  it('conserve des cibles différentes pour chaque série du même exercice', () => {
    const workout = emptyWorkout();
    workout.addExercise('pull-up');

    workout.addSet(0, { reps: 8, weight: 10 });
    workout.addSet(0, { reps: 7, weight: 10 });
    workout.addSet(0, { reps: 6, weight: 5 });

    expect(workout.exercises[0].sets.map((s) => s.targets)).toEqual([
      { reps: 8, weight: 10 },
      { reps: 7, weight: 10 },
      { reps: 6, weight: 5 },
    ]);
  });

  it('accepte le même exercice à deux endroits de la séance', () => {
    const workout = emptyWorkout();
    workout.addExercise('pull-up');
    workout.addExercise('row');
    workout.addExercise('pull-up');

    workout.addSet(2, { reps: 5 });

    expect(workout.exercises.map((e) => e.exerciseId)).toEqual(['pull-up', 'row', 'pull-up']);
    // La série est allée sur le SECOND pull-up, pas sur le premier :
    // c'est la position qui désigne l'exercice, pas son identifiant.
    expect(workout.exercises[0].sets).toHaveLength(0);
    expect(workout.exercises[2].sets).toHaveLength(1);
  });

  it('refuse d ajouter une série à un exercice qui n existe pas', () => {
    expect(() => emptyWorkout().addSet(0, { reps: 8 })).toThrow();
  });

  it('refuse une série qui ne cible aucune mesure', () => {
    const workout = emptyWorkout();
    workout.addExercise('pull-up');

    expect(() => workout.addSet(0, {})).toThrow();
  });

  it('refuse une cible négative mais accepte zéro (poids du corps)', () => {
    const workout = emptyWorkout();
    workout.addExercise('pull-up');

    expect(() => workout.addSet(0, { weight: -5 })).toThrow();
    expect(() => workout.addSet(0, { reps: 8, weight: 0 })).not.toThrow();
  });

  it('décale les positions suivantes quand un exercice est retiré', () => {
    const workout = emptyWorkout();
    workout.addExercise('pull-up');
    workout.addExercise('row');
    workout.addExercise('dip');

    workout.removeExerciseAt(0);

    expect(workout.exercises.map((e) => e.exerciseId)).toEqual(['row', 'dip']);
  });

  it('s archive sans toucher à son contenu', () => {
    const workout = emptyWorkout();
    workout.addExercise('pull-up');

    workout.archive();

    expect(workout.isArchived).toBe(true);
    expect(workout.exercises).toHaveLength(1);
  });

  it('refuse un nom vide', () => {
    expect(() => PlannedWorkout.create({ id: 'pw-1', name: '  ' })).toThrow();
  });

  it('ne peut pas être modifié à travers la liste renvoyée par le getter', () => {
    const workout = emptyWorkout();
    workout.addExercise('pull-up');

    (workout.exercises as PlannedExercise[]).push({ exerciseId: 'triché', sets: [] });

    expect(workout.exercises).toHaveLength(1);
  });
});
