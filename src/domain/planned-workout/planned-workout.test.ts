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

  it('remplace son contenu d un coup', () => {
    const workout = emptyWorkout();
    workout.addExercise('pull-up');
    workout.addSet(0, { reps: 8 });

    workout.replaceExercises([
      { exerciseId: 'row', sets: [{ targets: { reps: 10 } }, { targets: { reps: 9 } }] },
    ]);

    expect(workout.exercises).toHaveLength(1);
    expect(workout.exercises[0].exerciseId).toBe('row');
    expect(workout.exercises[0].sets).toHaveLength(2);
  });

  it('valide le contenu remplacé comme celui d origine', () => {
    const workout = emptyWorkout();

    expect(() =>
      workout.replaceExercises([{ exerciseId: 'row', sets: [{ targets: {} }] }]),
    ).toThrow(/au moins une mesure/);
  });

  it('garde le rythme imposé d un exercice, et le sépare des séries libres', () => {
    const workout = PlannedWorkout.create({
      id: 'pw-1',
      name: 'Grease the groove',
      exercises: [
        { exerciseId: 'pull-up', sets: [{ targets: { reps: 5 } }], intervalSeconds: 60 },
        { exerciseId: 'row', sets: [{ targets: { reps: 8 } }] },
      ],
    });

    expect(workout.exercises[0].intervalSeconds).toBe(60);
    // Sans intervalle, l'exercice répond null plutôt que rien : l'appelant
    // n'a pas à distinguer "pas d'EMOM" de "champ oublié".
    expect(workout.exercises[1].intervalSeconds).toBeNull();
  });

  it('garde le rythme imposé quand on ajoute une série à l exercice', () => {
    const workout = PlannedWorkout.create({
      id: 'pw-1',
      name: 'Grease the groove',
      exercises: [{ exerciseId: 'pull-up', sets: [{ targets: { reps: 5 } }], intervalSeconds: 60 }],
    });

    workout.addSet(0, { reps: 5 });

    // Un round de plus, au même rythme : le nombre de rounds EST le nombre
    // de séries, il n'y a rien d'autre à mettre à jour.
    expect(workout.exercises[0].sets).toHaveLength(2);
    expect(workout.exercises[0].intervalSeconds).toBe(60);
  });

  it('refuse un intervalle nul ou fractionnaire', () => {
    const workout = emptyWorkout();

    expect(() =>
      workout.replaceExercises([{ exerciseId: 'pull-up', sets: [], intervalSeconds: 0 }]),
    ).toThrow(/au moins une seconde/);
    expect(() =>
      workout.replaceExercises([{ exerciseId: 'pull-up', sets: [], intervalSeconds: 1.5 }]),
    ).toThrow(/au moins une seconde/);
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
