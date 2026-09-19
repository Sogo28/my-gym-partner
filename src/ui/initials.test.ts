import { describe, expect, it } from 'vitest';
import { initialsOf } from './initials';

describe('initialsOf', () => {
  it('prend le prénom et le nom quand un séparateur les distingue', () => {
    expect(initialsOf('daniel.ogodieme@gmail.com')).toBe('DO');
    expect(initialsOf('daniel-ogodieme@gmail.com')).toBe('DO');
    expect(initialsOf('daniel_ogodieme@gmail.com')).toBe('DO');
  });

  it('se contente d une lettre quand l adresse ne donne qu un mot', () => {
    expect(initialsOf('daniel@gmail.com')).toBe('D');
  });

  it('s arrête à deux lettres, même quand l adresse en propose plus', () => {
    expect(initialsOf('jean.pierre.dupont@gmail.com')).toBe('JP');
  });

  it('ignore les chiffres, qui ne sont l initiale de rien', () => {
    expect(initialsOf('sogo28@gmail.com')).toBe('S');
    expect(initialsOf('28@gmail.com')).toBe('');
  });

  it('lit les lettres accentuées comme les autres', () => {
    expect(initialsOf('élodie.ünal@gmail.com')).toBe('ÉÜ');
  });

  it('ne se casse pas sur ce qui n est pas une adresse', () => {
    expect(initialsOf('')).toBe('');
    expect(initialsOf('   ')).toBe('');
    expect(initialsOf('@')).toBe('');
  });
});
