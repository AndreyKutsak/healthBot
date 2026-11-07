// Shared rules for reading FoodHistory entries, used by the bot, admin API and web app.

// Planned meals are not counted as eaten. Old records have no status field -> eaten.
const EATEN = { status: { $ne: 'planned' } };

function populatedFood(entry) {
  const f = entry.foodId;
  return f && typeof f === 'object' && f.caloriesPer100g !== undefined ? f : null;
}

// Protein/fat/carbs of one entry: the snapshot if present, otherwise computed from the
// populated catalog food (records made before snapshots existed). null = unknown.
function entryMacros(entry) {
  const food = populatedFood(entry);
  const pick = (snapshot, per100) => {
    if (snapshot !== null && snapshot !== undefined) return snapshot;
    if (food && entry.amountG) return Math.round(((food[per100] || 0) * entry.amountG) / 100);
    return null;
  };
  return {
    protein: pick(entry.protein, 'proteinPer100g'),
    fat: pick(entry.fat, 'fatPer100g'),
    carbs: pick(entry.carbs, 'carbsPer100g'),
  };
}

function entryName(entry) {
  return entry.name || populatedFood(entry)?.name || (entry.foodId && entry.foodId.name) || 'Невідомо';
}

// Totals for a list of entries. `incomplete` is true when some macros are unknown.
function sumNutrition(entries) {
  const total = { calories: 0, protein: 0, fat: 0, carbs: 0, incomplete: false, approx: false };
  for (const e of entries) {
    total.calories += e.calories || 0;
    const m = entryMacros(e);
    for (const k of ['protein', 'fat', 'carbs']) {
      if (m[k] === null) total.incomplete = true;
      else total[k] += m[k];
    }
    if (e.approx) total.approx = true;
  }
  return total;
}

// Snapshot for a catalog food and a portion in grams.
function snapshotFor(food, amountG) {
  const k = amountG / 100;
  return {
    name: food.name,
    calories: Math.round((food.caloriesPer100g || 0) * k),
    protein: Math.round((food.proteinPer100g || 0) * k),
    fat: Math.round((food.fatPer100g || 0) * k),
    carbs: Math.round((food.carbsPer100g || 0) * k),
  };
}

module.exports = { EATEN, entryMacros, entryName, sumNutrition, snapshotFor };
