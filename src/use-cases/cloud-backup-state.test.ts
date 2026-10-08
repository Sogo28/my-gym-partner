import { describe, expect, it } from 'vitest';
import type { Backup } from '../infra/backup';
import {
  backupStatePayload,
  CLOUD_HASH_KEY,
  CLOUD_PUSHED_AT_KEY,
} from './cloud-backup-state';

function backup(overrides: Partial<Backup> = {}): Backup {
  return {
    app: 'my-gym-partner',
    schemaVersion: 29,
    exportedAt: '2026-10-08T10:00:00.000Z',
    tables: { exercises: [{ id: 'pull-up' }] },
    ...overrides,
  };
}

describe('Empreinte de sauvegarde en ligne', () => {
  it("ignore l'heure d'export et ses propres réglages techniques", () => {
    const first = backup({
      tables: {
        exercises: [{ id: 'pull-up' }],
        settings: [
          { key: CLOUD_HASH_KEY, value: 'avant' },
          { key: CLOUD_PUSHED_AT_KEY, value: '2026-10-08' },
          { key: 'timer.readySeconds', value: '5' },
        ],
      },
    });
    const second = backup({
      exportedAt: '2026-10-09T12:00:00.000Z',
      tables: {
        exercises: [{ id: 'pull-up' }],
        settings: [
          { key: CLOUD_HASH_KEY, value: 'après' },
          { key: CLOUD_PUSHED_AT_KEY, value: '2026-10-09' },
          { key: 'timer.readySeconds', value: '5' },
        ],
      },
    });

    expect(backupStatePayload(second)).toBe(backupStatePayload(first));
  });

  it('change avec une préférence utile ou un média', () => {
    const original = backup({ tables: { settings: [{ key: 'timer.readySeconds', value: '5' }] } });
    const preference = backup({
      tables: { settings: [{ key: 'timer.readySeconds', value: '10' }] },
    });
    const media = backup({
      tables: original.tables,
      media: {
        files: [{ name: 'clip.mp4', size: 42, md5: null, contentType: 'video/mp4' }],
        missing: [],
      },
    });

    expect(backupStatePayload(preference)).not.toBe(backupStatePayload(original));
    expect(backupStatePayload(media)).not.toBe(backupStatePayload(original));
  });
});
