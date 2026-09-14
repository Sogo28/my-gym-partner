import { describe, expect, it } from 'vitest';
import { useCleanDatabase } from '../../test/support';
import { findById } from '../infra/workout-session-repository';
import { attachSessionPhoto, detachSessionPhoto } from './session-photo';
import { startWorkoutSession } from './workout-session-actions';

useCleanDatabase();

describe('Photo de fin de séance', () => {
  it('attache une photo à une séance existante', async () => {
    const session = await startWorkoutSession();

    await attachSessionPhoto(session.id, 'summer-shred.jpg');

    expect((await findById(session.id))?.photoUri).toBe('summer-shred.jpg');
  });

  it('la retire', async () => {
    const session = await startWorkoutSession();
    await attachSessionPhoto(session.id, 'summer-shred.jpg');

    await detachSessionPhoto(session.id);

    expect((await findById(session.id))?.photoUri).toBeNull();
  });

  it('refuse une séance introuvable', async () => {
    await expect(attachSessionPhoto('inconnue', 'x.jpg')).rejects.toThrow(/introuvable/);
  });
});
