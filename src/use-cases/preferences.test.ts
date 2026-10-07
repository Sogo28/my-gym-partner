import { describe, expect, it } from 'vitest';
import { useCleanDatabase } from '../../test/support';
import {
  captureCountdown,
  captureLimit,
  emomSetupCountdown,
  setCaptureCountdown,
  setCaptureLimit,
  setEmomSetupCountdown,
} from './preferences';

useCleanDatabase();

/**
 * Zéro est un choix VALABLE pour ces deux délais -- « immédiat » -- et c'est
 * ce qui rendait leur défaut inatteignable : `Number(null)` vaut zéro, donc
 * une préférence jamais réglée se lisait comme une préférence réglée sur zéro.
 */
describe('Les délais de décompte', () => {
  it('rendent leur défaut tant que rien n a été choisi', async () => {
    expect(await emomSetupCountdown()).toBe(10);
    expect(await captureCountdown()).toBe(5);
  });

  it('rendent le choix fait, y compris zéro', async () => {
    await setEmomSetupCountdown(15);
    expect(await emomSetupCountdown()).toBe(15);

    await setEmomSetupCountdown(0);
    expect(await emomSetupCountdown()).toBe(0);

    await setCaptureCountdown(0);
    expect(await captureCountdown()).toBe(0);
  });

  it('ignorent une valeur qui n est pas au menu', async () => {
    await setEmomSetupCountdown(7);
    expect(await emomSetupCountdown()).toBe(10);
  });
});

/**
 * La durée maximale d'une vidéo : sans limite tant qu'on n'en a pas fixé
 * une -- une série longue ne doit pas être coupée au milieu.
 */
describe('La durée maximale d une vidéo', () => {
  it('est sans limite par défaut', async () => {
    expect(await captureLimit()).toBe(0);
  });

  it('rend la limite choisie', async () => {
    await setCaptureLimit(120);
    expect(await captureLimit()).toBe(120);
  });

  it('ignore une durée qui n est pas au menu', async () => {
    await setCaptureLimit(45);
    expect(await captureLimit()).toBe(0);
  });
});
