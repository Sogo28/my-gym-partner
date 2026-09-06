import { randomUUID } from 'expo-crypto';
import { BodyMetric, BodyReading } from '../domain/body/body-metric';
import { DomainError } from '../domain/domain-error';
import {
  findAllMetrics,
  findAllReadings,
  findReadings,
  removeMetric,
  removeReading,
  saveMetric,
  saveReading,
} from '../infra/body-repository';

/**
 * Le suivi corporel : ce que le mètre ruban et la balance disent, et que
 * l'application ne peut pas produire elle-même.
 */

export async function recordReading(input: {
  metricId: string;
  value: number;
  at?: Date;
}): Promise<BodyReading> {
  const reading = BodyReading.record({
    id: randomUUID(),
    metricId: input.metricId,
    value: input.value,
    // Un relevé pris ce matin et saisi ce soir reste celui d'aujourd'hui :
    // la date est modifiable, et vaut maintenant par défaut.
    at: input.at ?? new Date(),
  });

  await saveReading(reading);
  return reading;
}

export async function correctReading(
  reading: BodyReading,
  value: number,
  at?: Date,
): Promise<BodyReading> {
  reading.correct(value, at);
  await saveReading(reading);
  return reading;
}

export const deleteReading = removeReading;
export const listReadings = findReadings;
export const listAllReadings = findAllReadings;
export const listMetrics = findAllMetrics;

/** Créer une mensuration que le catalogue de départ ne prévoit pas. */
export async function createMetric(input: {
  name: string;
  unit: string;
  muscleIds?: readonly string[];
}): Promise<BodyMetric> {
  const metric = BodyMetric.create({ id: randomUUID(), ...input });
  await saveMetric(metric);
  return metric;
}

export async function updateMetric(input: {
  metric: BodyMetric;
  name: string;
  muscleIds: readonly string[];
}): Promise<BodyMetric> {
  input.metric.rename(input.name);
  input.metric.changeMuscles(input.muscleIds);
  await saveMetric(input.metric);
  return input.metric;
}

/**
 * Supprimer une mensuration emporte ses relevés (ON DELETE CASCADE).
 *
 * Contrairement à un exercice, il n'y a rien à préserver : un relevé sans sa
 * mensuration ne veut plus rien dire -- « 58,5 » de quoi ?
 */
export async function deleteMetric(metric: BodyMetric): Promise<void> {
  if (metric.isBuiltIn) {
    throw new DomainError('Cette mensuration fait partie du catalogue et ne peut pas être supprimée.');
  }
  await removeMetric(metric.id);
}
