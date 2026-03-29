import { describe, it, expect, beforeEach } from 'vitest';
import { DiplomacyManager } from './DiplomacyManager';

describe('DiplomacyManager', () => {
  let dm: DiplomacyManager;

  beforeEach(() => {
    dm = new DiplomacyManager();
  });

  it('defaults to no treaty', () => {
    expect(dm.getTreaty(1, 2)).toBe('none');
  });

  it('sets and gets treaties', () => {
    dm.setTreaty(1, 2, 'alliance', 100);
    expect(dm.getTreaty(1, 2)).toBe('alliance');
    expect(dm.getTreaty(2, 1)).toBe('alliance'); // symmetric
  });

  it('canAttack returns true with no treaty', () => {
    expect(dm.canAttack(1, 2)).toBe(true);
  });

  it('canAttack returns false with non_aggression', () => {
    dm.setTreaty(1, 2, 'non_aggression', 0);
    expect(dm.canAttack(1, 2)).toBe(false);
    expect(dm.canAttack(2, 1)).toBe(false);
  });

  it('canAttack returns false with alliance', () => {
    dm.setTreaty(1, 2, 'alliance', 0);
    expect(dm.canAttack(1, 2)).toBe(false);
  });

  it('hasTradeAgreement works correctly', () => {
    expect(dm.hasTradeAgreement(1, 2)).toBe(false);
    dm.setTreaty(1, 2, 'non_aggression', 0);
    expect(dm.hasTradeAgreement(1, 2)).toBe(false);
    dm.setTreaty(1, 2, 'trade_agreement', 0);
    expect(dm.hasTradeAgreement(1, 2)).toBe(true);
    dm.setTreaty(1, 2, 'alliance', 0);
    expect(dm.hasTradeAgreement(1, 2)).toBe(true);
  });

  it('sharesVisibility only for alliance', () => {
    dm.setTreaty(1, 2, 'trade_agreement', 0);
    expect(dm.sharesVisibility(1, 2)).toBe(false);
    dm.setTreaty(1, 2, 'alliance', 0);
    expect(dm.sharesVisibility(1, 2)).toBe(true);
  });

  it('getAllies returns all non-hostile players', () => {
    dm.setTreaty(1, 2, 'non_aggression', 0);
    dm.setTreaty(1, 3, 'alliance', 0);
    expect(dm.getAllies(1).sort()).toEqual([2, 3]);
    expect(dm.getAllies(2)).toEqual([1]);
    expect(dm.getAllies(4)).toEqual([]);
  });

  it('getVisibilityPartners returns only alliance partners', () => {
    dm.setTreaty(1, 2, 'non_aggression', 0);
    dm.setTreaty(1, 3, 'alliance', 0);
    expect(dm.getVisibilityPartners(1)).toEqual([3]);
  });

  it('breaking a treaty removes it', () => {
    dm.setTreaty(1, 2, 'alliance', 0);
    expect(dm.getTreaty(1, 2)).toBe('alliance');
    dm.setTreaty(1, 2, 'none', 100);
    expect(dm.getTreaty(1, 2)).toBe('none');
    expect(dm.canAttack(1, 2)).toBe(true);
  });

  it('serializes and deserializes state', () => {
    dm.setTreaty(1, 2, 'alliance', 50);
    dm.setTreaty(1, 3, 'trade_agreement', 100);
    const state = dm._getState();

    const dm2 = new DiplomacyManager();
    dm2._loadState(state);
    expect(dm2.getTreaty(1, 2)).toBe('alliance');
    expect(dm2.getTreaty(1, 3)).toBe('trade_agreement');
    expect(dm2.getTreaty(2, 3)).toBe('none');
  });

  it('fires onTreatyChanged callback', () => {
    const changes: { p1: number; p2: number; type: string }[] = [];
    dm.onTreatyChanged = (p1, p2, type) => changes.push({ p1, p2, type });

    dm.setTreaty(1, 2, 'alliance', 0);
    dm.setTreaty(1, 2, 'none', 0);

    expect(changes).toHaveLength(2);
    expect(changes[0].type).toBe('alliance');
    expect(changes[1].type).toBe('none');
  });
});
