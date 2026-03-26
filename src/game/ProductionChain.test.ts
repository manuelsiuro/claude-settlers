import { describe, it, expect } from 'vitest';
import { BUILDING_DEFINITIONS, BuildingType } from './BuildingType';
import { ResourceType, RESOURCE_PROPERTIES } from './ResourceType';

/**
 * Production chain verification tests.
 * Ensures all building recipes form valid DAGs — every input is produced by
 * some building's output (or is a raw gathering output).
 */

/** Collect all resources produced by any building */
function getAllProducedResources(): Set<ResourceType> {
  const produced = new Set<ResourceType>();
  for (const def of Object.values(BUILDING_DEFINITIONS)) {
    if (!def.production) continue;
    for (const output of def.production.outputs) {
      produced.add(output.resource);
    }
  }
  return produced;
}

/** Get producer building types for a given resource */
function getProducers(resource: ResourceType): string[] {
  const producers: string[] = [];
  for (const [type, def] of Object.entries(BUILDING_DEFINITIONS)) {
    if (!def.production) continue;
    if (def.production.outputs.some(o => o.resource === resource)) {
      producers.push(type);
    }
  }
  return producers;
}

describe('Production Chain Verification', () => {
  it('all building recipe inputs should be produced by some building output', () => {
    const produced = getAllProducedResources();
    const missingInputs: { building: string; resource: string }[] = [];

    for (const [type, def] of Object.entries(BUILDING_DEFINITIONS)) {
      if (!def.production) continue;
      for (const input of def.production.inputs) {
        if (!produced.has(input.resource)) {
          missingInputs.push({ building: type, resource: input.resource });
        }
      }
    }

    expect(missingInputs).toEqual([]);
  });

  it('Hayfield → Hay → DairyFarm → Milk → CheeseMaker → Cheese', () => {
    const hayfield = BUILDING_DEFINITIONS[BuildingType.Hayfield];
    expect(hayfield.production!.outputs).toContainEqual({ resource: ResourceType.Hay, amount: 1 });

    const dairy = BUILDING_DEFINITIONS[BuildingType.DairyFarm];
    expect(dairy.production!.inputs).toContainEqual({ resource: ResourceType.Hay, amount: 1 });
    expect(dairy.production!.outputs).toContainEqual({ resource: ResourceType.Milk, amount: 1 });

    const cheese = BUILDING_DEFINITIONS[BuildingType.CheeseMakerBuilding];
    expect(cheese.production!.inputs).toContainEqual({ resource: ResourceType.Milk, amount: 1 });
    expect(cheese.production!.outputs).toContainEqual({ resource: ResourceType.Cheese, amount: 1 });
  });

  it('CattleRanch → Cattle → Butchery → Meat + RawLeather → Tannery → WorkedLeather', () => {
    const ranch = BUILDING_DEFINITIONS[BuildingType.CattleRanch];
    expect(ranch.production!.outputs).toContainEqual({ resource: ResourceType.Cattle, amount: 1 });

    const butchery = BUILDING_DEFINITIONS[BuildingType.Butchery];
    expect(butchery.production!.inputs).toContainEqual({ resource: ResourceType.Cattle, amount: 1 });
    expect(butchery.production!.outputs).toContainEqual({ resource: ResourceType.Meat, amount: 1 });
    expect(butchery.production!.outputs).toContainEqual({ resource: ResourceType.RawLeather, amount: 1 });

    const tannery = BUILDING_DEFINITIONS[BuildingType.Tannery];
    expect(tannery.production!.inputs).toContainEqual({ resource: ResourceType.RawLeather, amount: 1 });
    expect(tannery.production!.outputs).toContainEqual({ resource: ResourceType.WorkedLeather, amount: 1 });
  });

  it('CharcoalBurner: 2 Wood → 1 CoalOre', () => {
    const charcoal = BUILDING_DEFINITIONS[BuildingType.CharcoalBurner];
    expect(charcoal.production).not.toBeNull();
    expect(charcoal.production!.inputs).toContainEqual({ resource: ResourceType.Wood, amount: 2 });
    expect(charcoal.production!.outputs).toContainEqual({ resource: ResourceType.CoalOre, amount: 1 });
  });

  it('Vineyard → Grapes → Winery → Wine', () => {
    const vineyard = BUILDING_DEFINITIONS[BuildingType.Vineyard];
    expect(vineyard.production!.outputs).toContainEqual({ resource: ResourceType.Grapes, amount: 1 });

    const winery = BUILDING_DEFINITIONS[BuildingType.Winery];
    expect(winery.production!.inputs).toContainEqual({ resource: ResourceType.Grapes, amount: 1 });
    expect(winery.production!.outputs).toContainEqual({ resource: ResourceType.Wine, amount: 1 });
  });

  it('Well + Farm → Brewery → Beer → InnTavern (morale chain)', () => {
    const well = BUILDING_DEFINITIONS[BuildingType.Well];
    expect(well.production!.outputs).toContainEqual({ resource: ResourceType.WaterBarrel, amount: 1 });

    const farm = BUILDING_DEFINITIONS[BuildingType.Farm];
    expect(farm.production!.outputs).toContainEqual({ resource: ResourceType.Grain, amount: 1 });

    const brewery = BUILDING_DEFINITIONS[BuildingType.Brewery];
    expect(brewery.production!.inputs).toContainEqual({ resource: ResourceType.Grain, amount: 1 });
    expect(brewery.production!.inputs).toContainEqual({ resource: ResourceType.WaterBarrel, amount: 1 });
    expect(brewery.production!.outputs).toContainEqual({ resource: ResourceType.Beer, amount: 1 });

    const inn = BUILDING_DEFINITIONS[BuildingType.InnTavern];
    // InnTavern uses inputCategories: drink (required) + luxury (optional)
    expect(inn.production!.inputCategories).toContainEqual({ category: 'drink', required: true });
    expect(inn.production!.inputCategories).toContainEqual({ category: 'luxury', required: false });
    // Beer is a drink and FurCoat is a luxury, so InnTavern will accept both
    expect(RESOURCE_PROPERTIES[ResourceType.Beer].isDrink).toBe(true);
    expect(RESOURCE_PROPERTIES[ResourceType.FurCoat].isLuxury).toBe(true);
  });

  it('SheepFarm → Wool → WeaversHut → Cloth', () => {
    const sheep = BUILDING_DEFINITIONS[BuildingType.SheepFarm];
    expect(sheep.production!.outputs).toContainEqual({ resource: ResourceType.Wool, amount: 1 });

    const weaver = BUILDING_DEFINITIONS[BuildingType.WeaversHut];
    expect(weaver.production!.inputs).toContainEqual({ resource: ResourceType.Wool, amount: 1 });
    expect(weaver.production!.outputs).toContainEqual({ resource: ResourceType.Cloth, amount: 1 });
  });

  it('FletchersWorkshop: Wood + IronBars → Bow + Arrows', () => {
    const fletcher = BUILDING_DEFINITIONS[BuildingType.FletchersWorkshop];
    expect(fletcher.production!.inputs).toContainEqual({ resource: ResourceType.Wood, amount: 1 });
    expect(fletcher.production!.inputs).toContainEqual({ resource: ResourceType.IronBars, amount: 1 });
    expect(fletcher.production!.outputs).toContainEqual({ resource: ResourceType.Bow, amount: 1 });
    expect(fletcher.production!.outputs).toContainEqual({ resource: ResourceType.Arrows, amount: 1 });
  });

  it('Stable: Hay + Grain → Horses', () => {
    const stable = BUILDING_DEFINITIONS[BuildingType.Stable];
    expect(stable.production!.inputs).toContainEqual({ resource: ResourceType.Hay, amount: 1 });
    expect(stable.production!.inputs).toContainEqual({ resource: ResourceType.Grain, amount: 1 });
    expect(stable.production!.outputs).toContainEqual({ resource: ResourceType.Horses, amount: 1 });
  });

  it('SiegeWorkshop: Wood + IronBars → SiegeRam', () => {
    const siege = BUILDING_DEFINITIONS[BuildingType.SiegeWorkshop];
    expect(siege.production!.inputs).toContainEqual({ resource: ResourceType.Wood, amount: 2 });
    expect(siege.production!.inputs).toContainEqual({ resource: ResourceType.IronBars, amount: 2 });
    expect(siege.production!.outputs).toContainEqual({ resource: ResourceType.SiegeRam, amount: 1 });
  });

  it('each resource should have at least one producer', () => {
    // Resources that are never produced (raw ingredients from outside the system) — should be empty
    const neverProduced: ResourceType[] = [];
    for (const r of Object.values(ResourceType)) {
      const producers = getProducers(r);
      if (producers.length === 0) {
        neverProduced.push(r);
      }
    }
    // All resource types should have a producer except tools (produced dynamically by Toolmaker)
    // Tools are produced via ToolProductionManager, not static production recipes
    const toolTypes: string[] = [
      ResourceType.Axe, ResourceType.Pickaxe, ResourceType.Saw,
      ResourceType.Scythe, ResourceType.FishingRod, ResourceType.Hammer,
      ResourceType.Shovel, ResourceType.RollingPin, ResourceType.Cleaver,
      ResourceType.Crucible, ResourceType.Tongs,
    ];
    for (const r of neverProduced) {
      // Tools are produced by ToolmakerWorkshop dynamically, not via static recipes
      expect(toolTypes).toContain(r);
    }
  });
});
