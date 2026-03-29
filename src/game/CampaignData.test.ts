import { describe, it, expect } from 'vitest';
import { CAMPAIGN_SCENARIOS } from './CampaignData';

describe('CampaignData', () => {
  it('has at least 5 campaign scenarios', () => {
    expect(CAMPAIGN_SCENARIOS.length).toBeGreaterThanOrEqual(5);
  });

  it('all scenarios have unique IDs', () => {
    const ids = CAMPAIGN_SCENARIOS.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all scenarios have at least 1 objective', () => {
    for (const s of CAMPAIGN_SCENARIOS) {
      expect(s.objectives.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('all scenarios have valid difficulty', () => {
    for (const s of CAMPAIGN_SCENARIOS) {
      expect(['easy', 'normal', 'hard']).toContain(s.difficulty);
    }
  });

  it('all scenarios have valid scenario type', () => {
    const validScenarios = ['default', 'island', 'continent', 'archipelago', 'river_valley', 'mountain_pass', 'oasis', 'peninsula'];
    for (const s of CAMPAIGN_SCENARIOS) {
      expect(validScenarios).toContain(s.scenario);
    }
  });

  it('all objectives have valid types', () => {
    const validTypes = ['buildings', 'population', 'territory', 'gold', 'military', 'time_survive'];
    for (const s of CAMPAIGN_SCENARIOS) {
      for (const obj of s.objectives) {
        expect(validTypes).toContain(obj.type);
      }
    }
  });

  it('all objectives have positive targets', () => {
    for (const s of CAMPAIGN_SCENARIOS) {
      for (const obj of s.objectives) {
        expect(obj.target).toBeGreaterThan(0);
      }
    }
  });
});
