import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRequirements, calculateSchedule, calculatePlannedIngredientCost, formatClock } from './engine.js';

const ingredients = [
  { id: 'rice', name: 'Rice', unit: 'kg', onHand: 15, reserved: 0, safetyStock: 2, unitCost: 60 },
  { id: 'box', name: 'Box', unit: 'pcs', onHand: 100, reserved: 10, safetyStock: 10, unitCost: 5 }
];
const recipes = [{
  id: 'biryani', name: 'Biryani', yield: 10, batchCapacity: 25,
  ingredients: { rice: 0.8, box: 10 },
  steps: [
    { name: 'Prep', station: 'Prep', minutes: 10, dependsOn: [] },
    { name: 'Cook', station: 'Hot', minutes: 20, dependsOn: [0] },
    { name: 'Pack', station: 'Pack', minutes: 5, dependsOn: [1] }
  ]
}];
const stations = [
  { name: 'Prep', lanes: 1, availableMinutes: 480 },
  { name: 'Hot', lanes: 1, availableMinutes: 480 },
  { name: 'Pack', lanes: 1, availableMinutes: 480 }
];

test('recipe quantities scale and aggregate across active orders', () => {
  const orders = [
    { id: 'A', recipeId: 'biryani', portions: 50, deadline: '12:00', status: 'Confirmed' },
    { id: 'B', recipeId: 'biryani', portions: 25, deadline: '12:30', status: 'Confirmed' },
    { id: 'C', recipeId: 'biryani', portions: 100, deadline: '13:00', status: 'Cancelled' }
  ];
  const result = calculateRequirements(orders, recipes, ingredients);
  assert.equal(result.find(x => x.id === 'rice').required, 6);
  assert.equal(result.find(x => x.id === 'box').required, 75);
  assert.equal(result.find(x => x.id === 'box').usable, 90);
});

test('shortage is requirement minus usable stock, never negative', () => {
  const result = calculateRequirements([{ id: 'A', recipeId: 'biryani', portions: 250, deadline: '12:00', status: 'Confirmed' }], recipes, ingredients);
  const rice = result.find(x => x.id === 'rice');
  assert.equal(rice.required, 20);
  assert.equal(rice.usable, 15);
  assert.equal(rice.shortage, 5);
});

test('scheduler respects recipe dependencies and batch counts', () => {
  const orders = [{ id: 'A', customer: 'Test', recipeId: 'biryani', portions: 50, deadline: '10:00', status: 'Confirmed' }];
  const rows = calculateSchedule(orders, recipes, stations);
  assert.deepEqual(rows.map(x => [x.start, x.finish, x.batches]), [[0,20,2],[20,60,2],[60,70,2]]);
  assert.equal(rows[2].atRisk, false);
});

test('station lanes prevent overlapping tasks on the same lane', () => {
  const twoRecipes = [
    ...recipes,
    { ...recipes[0], id: 'biryani2', name: 'Biryani 2' }
  ];
  const orders = [
    { id: 'A', recipeId: 'biryani', portions: 10, deadline: '12:00', status: 'Confirmed' },
    { id: 'B', recipeId: 'biryani2', portions: 10, deadline: '12:30', status: 'Confirmed' }
  ];
  const rows = calculateSchedule(orders, twoRecipes, stations);
  const prepRows = rows.filter(x => x.station === 'Prep');
  assert.equal(prepRows[0].start, 0);
  assert.equal(prepRows[1].start, 10);
});

test('planned ingredient cost uses scaled recipe quantities and unit costs', () => {
  const orders = [{ id: 'A', recipeId: 'biryani', portions: 50, deadline: '12:00', status: 'Confirmed' }];
  assert.equal(calculatePlannedIngredientCost(orders, recipes, ingredients), 50 * 0.8 / 10 * 60 + 50 * 10 / 10 * 5);
});

test('clock formatting supports times after noon', () => {
  assert.equal(formatClock(300), '13:00');
});
