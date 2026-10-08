import { describe, expect, it } from 'vitest';
import { kgToLb, lbToKg } from './weight-units';

describe('Les livres', () => {
  it('se convertissent en kilos au dixième', () => {
    expect(lbToKg(45)).toBe(20.4);
    expect(lbToKg(2.5)).toBe(1.1);
    expect(lbToKg(0)).toBe(0);
  });

  it('se relisent sur le cran posé, sans dérive', () => {
    for (const pounds of [2.5, 45, 135, 225, 317.5]) {
      expect(kgToLb(lbToKg(pounds))).toBe(pounds);
    }
  });

  it('relisent des kilos ronds au cran le plus proche', () => {
    expect(kgToLb(20)).toBe(45);
    expect(kgToLb(100)).toBe(220);
  });
});
