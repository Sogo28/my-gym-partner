import { describe, expect, it } from 'vitest';
import { BodyMetric, BodyReading } from './body-metric';

const at = (day: number) => new Date(2026, 8, day, 9, 0);

const thigh = () =>
  BodyMetric.create({
    id: 'thigh',
    name: 'Tour de cuisse',
    unit: 'cm',
    muscleIds: ['quadriceps', 'ischiojambiers'],
  });

describe('BodyMetric', () => {
  it('déclare son unité et les muscles qu elle concerne', () => {
    const metric = thigh();

    expect(metric.unit).toBe('cm');
    expect(metric.muscleIds).toEqual(['quadriceps', 'ischiojambiers']);
  });

  it('peut ne concerner aucun muscle', () => {
    // Le poids ne se rattache à aucun groupe en particulier.
    expect(BodyMetric.create({ id: 'weight', name: 'Poids', unit: 'kg' }).muscleIds).toEqual([]);
  });

  it('refuse un nom ou une unité vides', () => {
    expect(() => BodyMetric.create({ id: 'x', name: '  ', unit: 'cm' })).toThrow(/nom/);
    expect(() => BodyMetric.create({ id: 'x', name: 'Tour de cou', unit: ' ' })).toThrow(/unité/);
  });

  it('ne retient pas deux fois le même muscle', () => {
    const metric = BodyMetric.create({
      id: 'arm',
      name: 'Tour de bras',
      unit: 'cm',
      muscleIds: ['biceps', 'triceps', 'biceps'],
    });

    expect(metric.muscleIds).toEqual(['biceps', 'triceps']);
  });
});

describe('BodyReading', () => {
  it('retient une valeur et le jour où elle a été prise', () => {
    const reading = BodyReading.record({ id: 'r1', metricId: 'thigh', value: 58.5, at: at(6) });

    expect(reading.value).toBe(58.5);
    expect(reading.takenAt).toEqual(at(6));
  });

  it('refuse une valeur nulle ou négative', () => {
    // Contrairement à une performance, où zéro veut dire quelque chose (le
    // poids du corps), un tour de cuisse de zéro n'existe pas.
    expect(() =>
      BodyReading.record({ id: 'r', metricId: 'thigh', value: 0, at: at(6) }),
    ).toThrow(/strictement positif/);
    expect(() =>
      BodyReading.record({ id: 'r', metricId: 'thigh', value: -3, at: at(6) }),
    ).toThrow(/strictement positif/);
  });

  it('se corrige, valeur et date', () => {
    const reading = BodyReading.record({ id: 'r1', metricId: 'thigh', value: 58, at: at(6) });

    reading.correct(58.5, at(7));

    expect(reading.value).toBe(58.5);
    expect(reading.takenAt).toEqual(at(7));
  });

  it('garde sa date quand on ne corrige que la valeur', () => {
    const reading = BodyReading.record({ id: 'r1', metricId: 'thigh', value: 58, at: at(6) });

    reading.correct(59);

    expect(reading.takenAt).toEqual(at(6));
  });
});
