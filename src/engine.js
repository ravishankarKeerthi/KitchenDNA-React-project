/**
 * KitchenDNA demo calculation engine.
 *
 * Assumptions:
 * - Ingredient quantities use the same unit in recipe and stock records.
 * - Required quantity = recipe quantity per yield * order portions / recipe yield.
 * - Usable stock = max(0, on hand - reserved).
 * - Steps are scheduled in dependency order, with one availability clock per station lane.
 * - Batch durations are sequential per step (duration * batch count); no inter-batch pipelining.
 * - Times are minutes after shift start, default 08:00.
 */
export function calculateRequirements(orders, recipes, ingredients) {
  const recipeMap = new Map(recipes.map(r => [r.id, r]));
  const totals = Object.fromEntries(ingredients.map(i => [i.id, 0]));
  for (const order of orders) {
    if (['Dispatched', 'Cancelled'].includes(order.status)) continue;
    const recipe = recipeMap.get(order.recipeId);
    if (!recipe || !(recipe.yield > 0) || !(order.portions > 0)) continue;
    for (const [ingredientId, qtyPerYield] of Object.entries(recipe.ingredients)) {
      if (ingredientId in totals) {
        totals[ingredientId] += qtyPerYield * order.portions / recipe.yield;
      }
    }
  }
  return ingredients.map(item => {
    const required = totals[item.id] ?? 0;
    const usable = Math.max(0, item.onHand - item.reserved);
    const afterDemand = usable - required;
    return {
      ...item, required, usable, afterDemand,
      shortage: Math.max(0, required - usable),
      belowSafety: afterDemand < item.safetyStock
    };
  });
}

function timeToMinutes(value) {
  const [hours, minutes] = String(value).split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Invalid time "${value}". Use HH:MM.`);
  }
  return hours * 60 + minutes;
}

export function formatClock(minutesAfterShiftStart, shiftStart = '08:00') {
  const absolute = timeToMinutes(shiftStart) + minutesAfterShiftStart;
  const hours = Math.floor(absolute / 60) % 24;
  const minutes = absolute % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Stable, deterministic forward scheduler.
 * Sort orders by deadline, then order id; each step waits for dependencies and a free station lane.
 * This is a transparent planning estimate, not an industrial finite-capacity optimizer.
 */
export function calculateSchedule(orders, recipes, stations, shiftStart = '08:00') {
  const recipeMap = new Map(recipes.map(r => [r.id, r]));
  const stationMap = new Map(stations.map(s => [s.name, s]));
  const laneAvailability = new Map();
  for (const station of stations) {
    const laneCount = Math.max(1, Math.floor(station.lanes));
    laneAvailability.set(station.name, Array(laneCount).fill(0));
  }

  const activeOrders = orders
    .filter(o => !['Cancelled', 'Dispatched'].includes(o.status))
    .slice()
    .sort((a, b) => timeToMinutes(a.deadline) - timeToMinutes(b.deadline) || a.id.localeCompare(b.id));

  const rows = [];
  for (const order of activeOrders) {
    const recipe = recipeMap.get(order.recipeId);
    if (!recipe || !(recipe.batchCapacity > 0)) continue;
    const batches = Math.ceil(order.portions / recipe.batchCapacity);
    const stepFinishTimes = [];

    for (let index = 0; index < recipe.steps.length; index++) {
      const step = recipe.steps[index];
      const missingDependency = (step.dependsOn || []).some(dep => dep < 0 || dep >= index);
      if (missingDependency) {
        throw new Error(`Recipe "${recipe.name}" has an invalid dependency for step "${step.name}". Dependencies must refer to earlier steps.`);
      }
      const dependencyFinish = (step.dependsOn || []).reduce((latest, dep) => Math.max(latest, stepFinishTimes[dep]), 0);
      const station = stationMap.get(step.station);
      if (!station) throw new Error(`Station "${step.station}" used by "${step.name}" is not configured.`);
      if (!laneAvailability.has(step.station)) laneAvailability.set(step.station, Array(Math.max(1, Math.floor(station.lanes))).fill(0));
      const lanes = laneAvailability.get(step.station);
      let laneIndex = 0;
      for (let i = 1; i < lanes.length; i++) if (lanes[i] < lanes[laneIndex]) laneIndex = i;

      const duration = Math.max(0, Number(step.minutes) || 0) * batches;
      const start = Math.max(dependencyFinish, lanes[laneIndex]);
      const finish = start + duration;
      lanes[laneIndex] = finish;
      stepFinishTimes[index] = finish;
      const deadlineMinute = timeToMinutes(order.deadline) - timeToMinutes(shiftStart);
      rows.push({
        orderId: order.id, customer: order.customer, recipeName: recipe.name,
        step: step.name, station: step.station, lane: laneIndex + 1,
        batches, portions: order.portions, duration, start, finish,
        deadline: order.deadline, atRisk: finish > deadlineMinute
      });
    }
  }
  return rows;
}

export function getOrderForecast(order, scheduleRows) {
  const rows = scheduleRows.filter(row => row.orderId === order.id);
  const finish = rows.reduce((latest, row) => Math.max(latest, row.finish), 0);
  const deadlineMinutes = timeToMinutes(order.deadline) - timeToMinutes('08:00');
  return { finish, atRisk: finish > deadlineMinutes, hasSteps: rows.length > 0 };
}

export function calculatePlannedIngredientCost(orders, recipes, ingredients) {
  const recipeMap = new Map(recipes.map(r => [r.id, r]));
  const ingredientMap = new Map(ingredients.map(i => [i.id, i]));
  let total = 0;
  for (const order of orders) {
    if (['Cancelled', 'Dispatched'].includes(order.status)) continue;
    const recipe = recipeMap.get(order.recipeId);
    if (!recipe || !(recipe.yield > 0)) continue;
    for (const [ingredientId, qty] of Object.entries(recipe.ingredients)) {
      total += (ingredientMap.get(ingredientId)?.unitCost || 0) * qty * order.portions / recipe.yield;
    }
  }
  return total;
}
