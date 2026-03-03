import { initialState, simulatePeriod } from './engine/simulation.js';
import { drawCanvas, renderPlan, renderResults, renderSim } from './ui/render.js';

const app = document.querySelector('#app');
const STORAGE_KEY = 'food-distribution-tycoon-save-v1';

const saved = loadSave();
let state = saved?.state || initialState();
let phase = saved?.phase || 'plan';
let plan = saved?.plan || defaultPlan();
let simStart = 0;
let simResult = null;

function defaultPlan() {
  return {
    targetFocus: 'Independent',
    pricing: 'Balanced',
    marketingPct: 0.02,
    hireReps: 0,
    mixFocus: 'Balanced',
    supplierQuality: 'Balanced',
    spoilageControl: 'Med',
    serviceTarget: 'Med',
    capacityInvestment: 'None',
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, phase, plan }));
}

function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function render() {
  if (phase === 'plan') {
    renderPlan(app, state, plan, onPlanChange, runSimulation);
  } else if (phase === 'sim') {
    const progress = Math.min((performance.now() - simStart) / 11000, 1);
    renderSim(app, simResult, progress);
    const canvas = document.querySelector('#simCanvas');
    if (canvas) drawCanvas(canvas, state, simResult, progress);
    if (progress < 1) requestAnimationFrame(render);
    else setTimeout(() => {
      phase = 'results';
      saveState();
      render();
    }, 700);
  } else if (phase === 'results') {
    renderResults(app, state, nextPeriod, resetGame);
  }
}

function onPlanChange(key, value) {
  if (key === 'marketingPct') value = Number(value);
  if (key === 'hireReps') value = Math.max(0, Math.min(2, Number(value)));
  plan[key] = value;
  render();
}

function runSimulation() {
  const nextState = simulatePeriod(state, plan);
  simResult = nextState.lastResult;
  state = nextState;
  phase = 'sim';
  simStart = performance.now();
  saveState();
  render();
}

function nextPeriod() {
  if (state.period > 8) {
    phase = 'results';
    render();
    return;
  }
  phase = 'plan';
  plan = defaultPlan();
  saveState();
  render();
}

function resetGame() {
  state = initialState();
  plan = defaultPlan();
  phase = 'plan';
  saveState();
  render();
}

document.querySelector('#resetGame').addEventListener('click', resetGame);
render();
