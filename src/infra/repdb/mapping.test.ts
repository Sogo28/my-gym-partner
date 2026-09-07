import { describe, expect, it } from 'vitest';
import { MUSCLE_BY_SLUG, toDraft, type CatalogueEntry } from './mapping';

const entry = (over: Partial<CatalogueEntry> = {}): CatalogueEntry => ({
  id: 'pull-up',
  name: 'Pull Up',
  equipment: 'pull_up_bar',
  primaryMuscles: ['latissimus_dorsi'],
  secondaryMuscles: ['biceps_brachii'],
  isUnilateral: false,
  isBodyweight: true,
  images: [],
  ...over,
});

describe('Traduction du catalogue RepDB', () => {
  it('replie leur anatomie sur nos groupes', () => {
    const draft = toDraft(
      entry({ primaryMuscles: ['rectus_abdominis', 'transverse_abdominis'] }),
    );

    // Deux muscles chez eux, un seul groupe chez nous : rien à arbitrer.
    expect(draft.primaryMuscleId).toBe('abdominaux');
    expect(draft.secondaryMuscleIds).toEqual(['biceps']);
  });

  it('garde un seul muscle principal et rétrograde les autres', () => {
    const draft = toDraft(
      entry({ primaryMuscles: ['hamstrings', 'quadriceps'], secondaryMuscles: [] }),
    );

    expect(draft.primaryMuscleId).toBe('ischiojambiers');
    expect(draft.secondaryMuscleIds).toEqual(['quadriceps']);
  });

  it('ignore ce que nous ne savons pas nommer', () => {
    // Adducteurs, fléchisseurs de hanche, grand dentelé : aucun groupe chez
    // nous. Les ranger ailleurs inventerait une information.
    const draft = toDraft(
      entry({ primaryMuscles: ['adductors'], secondaryMuscles: ['serratus_anterior'] }),
    );

    expect(draft.primaryMuscleId).toBeNull();
    expect(draft.secondaryMuscleIds).toEqual([]);
  });

  it('pose les adresses des illustrations sans rien télécharger', () => {
    const draft = toDraft(entry({ images: ['images/flat/pull-up-start.webp'] }));

    expect(draft.imageUris).toEqual([
      'https://exercise-dataset.com/images/flat/pull-up-start.webp',
    ]);
  });

  it('mesure la charge sauf au poids du corps', () => {
    expect(toDraft(entry({ isBodyweight: true })).measurementIds).toEqual(['reps']);
    expect(toDraft(entry({ isBodyweight: false })).measurementIds).toEqual(['reps', 'weight']);
  });

  it('ne traduit que vers des groupes de notre catalogue', () => {
    const ours = [
      'pectoraux', 'dos', 'epaules', 'biceps', 'triceps', 'avantbras',
      'abdominaux', 'lombaires', 'fessiers', 'quadriceps', 'ischiojambiers', 'mollets',
    ];

    expect([...new Set(Object.values(MUSCLE_BY_SLUG))].sort()).toEqual([...ours].sort());
  });
});
