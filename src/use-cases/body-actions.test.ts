import { describe, expect, it } from 'vitest';
import { useCleanDatabase } from '../../test/support';
import {
  createMetric,
  correctReading,
  deleteMetric,
  deleteReading,
  listMetrics,
  listReadings,
  recordReading,
} from './body-actions';
import { findLatestReading } from '../infra/body-repository';

useCleanDatabase();

const day = (d: number) => new Date(2026, 8, d, 9, 0);

describe('Catalogue des mensurations', () => {
  it('propose un catalogue de départ, muscles rattachés', async () => {
    const metrics = await listMetrics();
    const thigh = metrics.find((metric) => metric.name === 'Tour de cuisse');

    expect(thigh?.unit).toBe('cm');
    // Ce sont ces muscles qui permettront de retrouver les exercices qui
    // soutiennent la progression.
    expect(thigh?.muscleIds).toContain('quadriceps');
    expect(metrics.find((metric) => metric.name === 'Poids')?.muscleIds).toEqual([]);
  });

  it('accepte une mensuration que le catalogue ne prévoit pas', async () => {
    await createMetric({ name: 'Tour de cou', unit: 'cm', muscleIds: ['epaules'] });

    const created = (await listMetrics()).find((metric) => metric.name === 'Tour de cou');
    expect(created?.unit).toBe('cm');
    expect(created?.isBuiltIn).toBe(false);
  });

  it('refuse de supprimer une mensuration du catalogue de départ', async () => {
    const [builtIn] = await listMetrics();

    await expect(deleteMetric(builtIn)).rejects.toThrow(/catalogue/);
  });

  it('supprime une mensuration créée à la main, et ses relevés avec', async () => {
    const metric = await createMetric({ name: 'Tour de cou', unit: 'cm' });
    await recordReading({ metricId: metric.id, value: 38 });

    await deleteMetric(metric);

    // Un relevé sans sa mensuration ne veut plus rien dire : « 38 » de quoi ?
    expect(await listReadings(metric.id)).toHaveLength(0);
  });
});

describe('Relevés', () => {
  it('enregistre une valeur datée', async () => {
    await recordReading({ metricId: 'tourdecuisse', value: 58.5, at: day(6) });

    const [reading] = await listReadings('tourdecuisse');
    expect(reading.value).toBe(58.5);
    expect(reading.takenAt).toEqual(day(6));
  });

  it('rend les relevés du plus récent au plus ancien', async () => {
    await recordReading({ metricId: 'tourdecuisse', value: 56, at: day(1) });
    await recordReading({ metricId: 'tourdecuisse', value: 58, at: day(20) });
    await recordReading({ metricId: 'tourdecuisse', value: 57, at: day(10) });

    expect((await listReadings('tourdecuisse')).map((r) => r.value)).toEqual([58, 57, 56]);
  });

  it('donne le dernier relevé, c est à dire le plus récemment PRIS', async () => {
    // Saisi en second, mais daté d'avant : ce n'est pas le dernier.
    await recordReading({ metricId: 'tourdecuisse', value: 58, at: day(20) });
    await recordReading({ metricId: 'tourdecuisse', value: 56, at: day(1) });

    expect((await findLatestReading('tourdecuisse'))?.value).toBe(58);
  });

  it('ne mélange pas les mensurations', async () => {
    await recordReading({ metricId: 'tourdecuisse', value: 58 });
    await recordReading({ metricId: 'poids', value: 72 });

    expect(await listReadings('poids')).toHaveLength(1);
    expect((await listReadings('poids'))[0].value).toBe(72);
  });

  it('corrige une saisie', async () => {
    const reading = await recordReading({ metricId: 'tourdecuisse', value: 55, at: day(6) });

    await correctReading(reading, 58.5);

    expect((await listReadings('tourdecuisse'))[0].value).toBe(58.5);
  });

  it('supprime un relevé', async () => {
    const reading = await recordReading({ metricId: 'tourdecuisse', value: 58 });

    await deleteReading(reading.id);

    expect(await listReadings('tourdecuisse')).toHaveLength(0);
  });
});
