import { describe, expect, it } from 'vitest';
import { Exercise } from './exercise';

const validInput = {
  id: 'ex-1',
  name: 'Weighted Pull-Up',
  isUnilateral: false,
  measurementIds: ['reps', 'weight'],
};

describe('Exercise', () => {
  it('est mesurable par les mesures qu on lui donne', () => {
    const exercise = Exercise.create(validInput);

    expect(exercise.name).toBe('Weighted Pull-Up');
    expect(exercise.measurementIds).toEqual(['reps', 'weight']);
    expect(exercise.isUnilateral).toBe(false);
  });

  it('refuse un nom vide ou constitué d espaces', () => {
    expect(() => Exercise.create({ ...validInput, name: '   ' })).toThrow();
  });

  it('normalise le nom en supprimant les espaces superflus', () => {
    expect(Exercise.create({ ...validInput, name: '  Front Lever  ' }).name).toBe('Front Lever');
  });

  it('refuse un exercice sans aucune mesure : il serait impossible de mesurer sa performance', () => {
    expect(() => Exercise.create({ ...validInput, measurementIds: [] })).toThrow();
  });

  it('refuse deux fois la même mesure', () => {
    expect(() => Exercise.create({ ...validInput, measurementIds: ['reps', 'reps'] })).toThrow();
  });

  it('ne peut pas être modifié depuis la liste passée à la création', () => {
    const measurementIds = ['reps'];
    const exercise = Exercise.create({ ...validInput, measurementIds });

    measurementIds.push('weight');

    expect(exercise.measurementIds).toEqual(['reps']);
  });

  it('conserve son identité lorsqu il est renommé', () => {
    const exercise = Exercise.create(validInput);

    exercise.rename('Pull-Up lesté');

    expect(exercise.name).toBe('Pull-Up lesté');
    expect(exercise.id).toBe('ex-1');
  });

  it('peut changer ses mesures : les performances passées ont copié les leurs', () => {
    const exercise = Exercise.create(validInput);

    exercise.changeMeasurements(['duration']);

    expect(exercise.measurementIds).toEqual(['duration']);
  });

  it('refuse de se retrouver sans aucune mesure après modification', () => {
    const exercise = Exercise.create(validInput);

    expect(() => exercise.changeMeasurements([])).toThrow();
    expect(exercise.measurementIds).toEqual(['reps', 'weight']);
  });

  it('s archive sans rien perdre de son identité', () => {
    const exercise = Exercise.create(validInput);

    expect(exercise.isArchived).toBe(false);
    exercise.archive();
    expect(exercise.isArchived).toBe(true);
    expect(exercise.id).toBe('ex-1');

    exercise.unarchive();
    expect(exercise.isArchived).toBe(false);
  });

  it('refuse un renommage vide', () => {
    const exercise = Exercise.create(validInput);

    expect(() => exercise.rename('')).toThrow();
    expect(exercise.name).toBe('Weighted Pull-Up');
  });
});
