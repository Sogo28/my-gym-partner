import { describe, expect, it } from 'vitest';
import type { Backup } from './backup';
import {
  isSafeMediaName,
  mediaNamesOf,
  setVideoNamesOf,
  validateMediaManifest,
} from './backup-media';

const backup: Backup = {
  app: 'my-gym-partner',
  schemaVersion: 29,
  exportedAt: '2026-10-08T10:00:00.000Z',
  tables: {
    exercise_media: [
      { uri: 'demo.mp4' },
      { uri: 'https://exercise-dataset.com/illustration.webp' },
      { uri: 'photo.jpg' },
    ],
    performance_sets: [{ video_uri: 'set.mp4' }, { video_uri: 'demo.mp4' }],
    workout_sessions: [{ photo_uri: 'finish.jpg' }, { photo_uri: null }],
  },
};

describe('Médias réclamés par une sauvegarde', () => {
  it('garde les fichiers locaux une fois, mais pas les illustrations distantes', () => {
    expect(mediaNamesOf(backup)).toEqual(['demo.mp4', 'finish.jpg', 'photo.jpg', 'set.mp4']);
  });

  it('refuse qu un manifeste sorte du dossier média', () => {
    expect(isSafeMediaName('8a9f.mp4')).toBe(true);
    expect(isSafeMediaName('../database')).toBe(false);
    expect(isSafeMediaName('folder/video.mp4')).toBe(false);
  });

  it('exige une description pour chaque fichier référencé par SQLite', () => {
    expect(() =>
      validateMediaManifest({
        ...backup,
        media: {
          files: [
            { name: 'demo.mp4', size: 10, md5: null, contentType: 'video/mp4' },
            { name: 'finish.jpg', size: 10, md5: null, contentType: 'image/jpeg' },
            { name: 'photo.jpg', size: 10, md5: null, contentType: 'image/jpeg' },
          ],
          missing: ['set.mp4'],
        },
      }),
    ).not.toThrow();

    expect(() =>
      validateMediaManifest({
        ...backup,
        media: {
          files: [{ name: '../database', size: 10, md5: null, contentType: 'video/mp4' }],
          missing: [],
        },
      }),
    ).toThrow(/invalide/);
  });
});

describe('Les vidéos des séries laissées de côté', () => {
  it('ne visent que les vidéos de séries, pas un fichier qu un exercice cite aussi', () => {
    // `demo.mp4` est aussi la démonstration d'un exercice : l'exclure l'en priverait.
    expect(setVideoNamesOf(backup)).toEqual(['set.mp4']);
  });

  it('se lisent comme exclues, distinctes des fichiers perdus', () => {
    const manifest = validateMediaManifest({
      ...backup,
      media: {
        files: [
          { name: 'demo.mp4', size: 10, md5: null, contentType: 'video/mp4' },
          { name: 'finish.jpg', size: 10, md5: null, contentType: 'image/jpeg' },
          { name: 'photo.jpg', size: 10, md5: null, contentType: 'image/jpeg' },
        ],
        missing: [],
        excluded: ['set.mp4'],
      },
    });
    expect(manifest.excluded).toEqual(['set.mp4']);
    expect(manifest.missing).toEqual([]);
  });
});
