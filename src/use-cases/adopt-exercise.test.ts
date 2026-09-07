import { describe, expect, it } from 'vitest';
import { anExercise, useCleanDatabase } from '../../test/support';
import { findAll } from '../infra/exercise-repository';
import type { CatalogueEntry } from '../infra/repdb/mapping';
import { adoptFromCatalogue, originOf } from './adopt-exercise';

useCleanDatabase();

const pullUp: CatalogueEntry = {
  id: 'pull-up',
  name: 'Pull Up',
  equipment: 'pull_up_bar',
  primaryMuscles: ['latissimus_dorsi'],
  secondaryMuscles: ['biceps_brachii', 'adductors'],
  isUnilateral: false,
  isBodyweight: true,
  images: ['images/flat/pull-up-start.webp', 'images/flat/pull-up-peak.webp'],
};

describe('Adopter un exercice du catalogue', () => {
  it('le crée traduit, avec ses illustrations et son origine', async () => {
    await adoptFromCatalogue(pullUp);

    const [created] = await findAll();
    expect(created.name).toBe('Pull Up');
    expect(created.measurementIds).toEqual(['reps']);
    expect(created.primaryMuscleId).toBe('dos');
    // « adductors » n'a pas de groupe chez nous : il est écarté, pas rangé
    // ailleurs.
    expect(created.secondaryMuscleIds).toEqual(['biceps']);
    expect(created.origin).toBe('repdb:pull-up');
    expect(created.media).toEqual([
      {
        kind: 'image',
        uri: 'https://exercise-dataset.com/images/flat/pull-up-start.webp',
        label: null,
        trim: null,
      },
      {
        kind: 'image',
        uri: 'https://exercise-dataset.com/images/flat/pull-up-peak.webp',
        label: null,
        trim: null,
      },
    ]);
  });

  it('laisse tes propres exercices sans origine', async () => {
    await anExercise();

    expect((await findAll())[0].origin).toBeNull();
  });

  it('garde l origine intacte quand l exercice est renommé', async () => {
    const adopted = await adoptFromCatalogue(pullUp);
    adopted.rename('Tractions');

    // C'est tout l'intérêt de la colonne : après renommage, plus rien d'autre
    // ne dit que cet exercice vient du catalogue.
    expect(adopted.origin).toBe(originOf(pullUp));
  });
});
