import { describe, expect, it } from 'vitest';
import { PlannedWorkout } from '../domain/planned-workout/planned-workout';
import { describeWorkout } from './share-workout';

const nameOf = (exerciseId: string) => (exerciseId === 'pull-ups' ? 'Tractions' : exerciseId);
const unitOf = (measurementId: string) => (measurementId === 'reps' ? 'reps' : measurementId);

describe('Décrire un entraînement en texte', () => {
  it('liste les exercices et leurs séries prévues', () => {
    const workout = PlannedWorkout.create({
      id: 'w1',
      name: 'Pull day',
      exercises: [
        {
          exerciseId: 'pull-ups',
          sets: [{ targets: { reps: 8 } }, { targets: { reps: 6 } }],
        },
      ],
    });

    const text = describeWorkout(workout, nameOf, unitOf);

    expect(text).toContain('Pull day');
    expect(text).toContain('1 exercice · 2 séries');
    expect(text).toContain('1. Tractions');
    // Insécable, pas une espace ordinaire : la plupart des destinataires
    // rendent le texte comme du HTML, qui fond toute suite d'espaces
    // normales en une seule.
    expect(text).toContain('   1. 8 reps');
    expect(text).toContain('   2. 6 reps');
  });

  it('annonce la cadence d un EMOM, puis ses rounds comme des séries', () => {
    const workout = PlannedWorkout.create({
      id: 'w1',
      name: 'Grease the groove',
      exercises: [
        {
          exerciseId: 'pull-ups',
          sets: [{ targets: { reps: 5 } }, { targets: { reps: 5 } }],
          intervalSeconds: 60,
        },
      ],
    });

    const text = describeWorkout(workout, nameOf, unitOf);

    expect(text).toContain('   EMOM · un round toutes les 1:00');
    // Des rounds se lisent comme les séries qu'ils sont : la cadence est une
    // annotation, pas un résumé qui remplacerait la liste.
    expect(text).toContain('   1. 5 reps');
    expect(text).toContain('   2. 5 reps');
  });

  it('dit qu un exercice sans série n en a aucune', () => {
    const workout = PlannedWorkout.create({
      id: 'w1',
      name: 'Pull day',
      exercises: [{ exerciseId: 'pull-ups', sets: [] }],
    });

    const text = describeWorkout(workout, nameOf, unitOf);

    expect(text).toContain('aucune série prévue');
  });
});
