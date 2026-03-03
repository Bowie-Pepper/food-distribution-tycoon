import { GAME_CONFIG } from '../config/gameConfig.js';
import { seededRandom } from './rng.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export function initialState() {
  const s = GAME_CONFIG.starting;
  const revenue = s.customers * s.avgSpend;
  const grossProfit = revenue * s.grossMarginPct;
  const smExpense = revenue * 0.028 + s.salesReps * GAME_CONFIG.costs.repCost;
  const operating = revenue * 0.122 + GAME_CONFIG.costs.warehouseFixed + GAME_CONFIG.costs.techAdminFixed;
  const ebitda = grossProfit - smExpense - operating;
  return {
    period: 1,
    seed: GAME_CONFIG.seed,
    salesReps: s.salesReps,
    customers: s.customers,
    avgSpend: s.avgSpend,
    grossMarginPct: s.grossMarginPct,
    retentionPct: s.retentionPct,
    serviceScore: s.serviceScore,
    capacity: s.capacity,
    cash: s.cash,
    syscoPressure: s.syscoPressure,
    lastResult: {
      revenue,
      grossProfit,
      smExpense,
      operating,
      ebitda,
      ebitdaMargin: ebitda / revenue,
      acquisition: 20,
      churned: 14,
      retainedPct: s.retentionPct,
      capacityUtilization: (s.customers / s.capacity) * 100,
      valuation: computeValuation(ebitda, s.grossMarginPct, 0.04, s.retentionPct, s.serviceScore),
      narrative: 'Springfield Fine Foods is stable, with room to improve margins and growth.',
      event: null,
      pnl: {},
    },
    history: [],
  };
}

function pickEvent(rand, plan) {
  const pool = GAME_CONFIG.events.map((e) => ({ ...e, chance: adjustedChance(e, plan) }));
  if (rand() > 0.45) return null;
  let cursor = rand();
  for (const e of pool) {
    if (cursor < e.chance) return e;
    cursor -= e.chance;
  }
  return null;
}

function adjustedChance(event, plan) {
  if (event.name === 'Supplier hiccup' && plan.supplierQuality === 'Reliable') return event.chance * 0.35;
  if (event.name === 'Sysco promo blitz' && plan.pricing === 'Aggressive') return event.chance * 0.75;
  if (event.name === 'Local “eat fresh” trend' && plan.mixFocus === 'Premium') return event.chance * 1.4;
  return event.chance;
}

function computeValuation(ebitda, gmPct, growthRate, retention, serviceScore) {
  const v = GAME_CONFIG.valuation;
  const annualizedEbitda = ebitda * GAME_CONFIG.periodsPerYear;
  const growthAdj = clamp((growthRate - 0.04) * v.growthWeight * 4, -0.3, 0.3);
  const gmAdj = clamp((gmPct - 0.18) * v.gmWeight * 8, -0.25, 0.25);
  const retentionAdj = clamp((retention - 0.88) * v.retentionWeight * 3, -0.2, 0.2);
  const serviceAdj = clamp((serviceScore - 75) / 100 * v.serviceWeight, -0.2, 0.2);
  const adjustment = clamp(growthAdj + gmAdj + retentionAdj + serviceAdj, -v.maxAdjustment, v.maxAdjustment);
  const multiple = v.baseMultiple + adjustment;
  return {
    annualizedEbitda,
    baseMultiple: v.baseMultiple,
    growthAdj,
    gmAdj,
    retentionAdj,
    serviceAdj,
    multiple,
    value: Math.max(annualizedEbitda * multiple, 0),
  };
}

export function simulatePeriod(state, plan) {
  const rand = seededRandom(state.seed, state.period);
  const c = GAME_CONFIG.coefficients;
  const costs = GAME_CONFIG.costs;
  const segment = GAME_CONFIG.segments[plan.targetFocus];
  const event = pickEvent(rand, plan);

  const marketingPct = plan.marketingPct;
  const repAdd = Number(plan.hireReps);
  const salesReps = state.salesReps + repAdd;

  let acquireRate = c.baseAcquireRate * segment.market;
  if (plan.pricing === 'Aggressive') acquireRate += c.aggressivePricingAcquireBoost;
  if (plan.pricing === 'Premium') acquireRate += c.premiumPricingAcquirePenalty;
  acquireRate += marketingPct * c.marketingAcquireBoost;
  acquireRate += salesReps * c.repAcquireBoost;
  acquireRate += state.serviceScore * c.serviceAcquireBoost / 100;
  acquireRate -= state.syscoPressure * 0.035;

  let churnRate = c.baseChurn - state.serviceScore * c.serviceChurnReduction / 100;
  if (plan.pricing === 'Premium' && state.serviceScore < 72) churnRate += 0.015;
  if (plan.mixFocus === 'Premium') churnRate -= 0.01 + segment.retentionFitPremium;

  let serviceScore = state.serviceScore + c.serviceTargetBase[plan.serviceTarget];
  if (plan.supplierQuality === 'Cheapest') serviceScore -= 4;
  if (plan.supplierQuality === 'Reliable') serviceScore += 3;
  if (plan.spoilageControl === 'High') serviceScore += 2;

  let gmPct = 0.18;
  if (plan.pricing === 'Aggressive') gmPct += c.aggressivePricingGmPenalty;
  if (plan.pricing === 'Premium') gmPct += c.premiumPricingGmBoost;
  if (plan.supplierQuality === 'Cheapest') gmPct += c.cheapestSupplierGmBoost;
  if (plan.supplierQuality === 'Reliable') gmPct += c.reliableSupplierGmPenalty;
  if (plan.mixFocus === 'Premium') gmPct += c.premiumMixGmBoost;
  if (plan.mixFocus === 'Value') gmPct += c.valueMixGmPenalty;

  let spoilage = c.spoilageBase + (plan.mixFocus === 'Premium' ? c.spoilagePremiumAdd : 0);
  spoilage += c[`spoilageControl${plan.spoilageControl}`];

  if (event) {
    if (event.effect.acquirePenalty) acquireRate -= event.effect.acquirePenalty;
    if (event.effect.serviceDelta) serviceScore += event.effect.serviceDelta;
    if (event.effect.premiumDemandBoost && plan.mixFocus === 'Premium') acquireRate += event.effect.premiumDemandBoost;
  }

  serviceScore = clamp(serviceScore + (rand() - 0.5) * 4, 50, 97);
  acquireRate = clamp(acquireRate, 0.02, 0.22);
  churnRate = clamp(churnRate, 0.04, 0.19);

  const acquired = Math.round(state.customers * acquireRate);
  const churned = Math.round(state.customers * churnRate);
  let customers = Math.max(state.customers + acquired - churned, 40);

  const capacity = state.capacity + costs.capacityGain[plan.capacityInvestment];
  const utilization = (customers / capacity) * 100;
  if (utilization > 100) {
    customers = Math.floor(capacity);
    serviceScore -= 6;
  }

  let avgSpend = state.avgSpend * segment.spend;
  if (plan.mixFocus === 'Premium') avgSpend *= 1.05;
  if (plan.mixFocus === 'Value') avgSpend *= 0.96;
  avgSpend *= 1 + (serviceScore - 70) / 900;

  let revenue = customers * avgSpend;
  const grossProfit = revenue * (gmPct - spoilage);
  const marketing = revenue * marketingPct;
  const salesPayroll = salesReps * costs.repCost;

  let warehouse = costs.warehouseFixed + revenue * costs.warehouseVarPct;
  let transport = revenue * (costs.transportVarPct + c.serviceTargetCost[plan.serviceTarget]);
  if (event?.effect.transportPctDelta) transport += revenue * event.effect.transportPctDelta;
  if (event?.effect.warehousePctDelta) warehouse += revenue * event.effect.warehousePctDelta;

  const techAdmin = costs.techAdminFixed + revenue * costs.techAdminVarPct;
  const capex = costs.capacityCost[plan.capacityInvestment];
  const operating = warehouse + transport + techAdmin + capex;
  const smExpense = marketing + salesPayroll;
  const ebitda = grossProfit - smExpense - operating;
  const ebitdaMargin = ebitda / revenue;
  const retainedPct = 1 - churnRate;
  const growth = state.lastResult ? (revenue - state.lastResult.revenue) / state.lastResult.revenue : 0.04;
  const valuation = computeValuation(ebitda, gmPct - spoilage, growth, retainedPct, serviceScore);

  const cash = state.cash + ebitda - capex;
  const syscoPressure = clamp(0.45 + rand() * 0.3 + (plan.pricing === 'Premium' ? 0.08 : 0), 0.35, 0.9);

  const result = {
    revenue,
    grossProfit,
    smExpense,
    operating,
    ebitda,
    ebitdaMargin,
    acquisition: acquired,
    churned,
    retainedPct,
    capacityUtilization: Math.min((customers / capacity) * 100, 100),
    valuation,
    event,
    narrative: narrativeForResult({ growth, gmPct: gmPct - spoilage, serviceScore, smPct: smExpense / revenue, utilization: (customers / capacity) * 100, event }),
    pnl: {
      marketing,
      salesPayroll,
      warehouse,
      transport,
      techAdmin,
      capex,
      spoilagePct: spoilage,
      gmPct: gmPct - spoilage,
    },
  };

  return {
    ...state,
    period: state.period + 1,
    customers,
    avgSpend,
    grossMarginPct: gmPct - spoilage,
    retentionPct: retainedPct,
    serviceScore,
    capacity,
    cash,
    salesReps,
    syscoPressure,
    lastResult: result,
    history: [...state.history, { period: state.period, plan, result }],
  };
}

function narrativeForResult({ growth, gmPct, serviceScore, smPct, utilization, event }) {
  const bits = [];
  bits.push(growth > 0.05 ? 'Customer demand expanded nicely.' : growth > 0 ? 'Growth was steady.' : 'Growth slowed this period.');
  bits.push(gmPct > 0.2 ? 'Margin quality improved.' : gmPct < 0.16 ? 'Margins were pressured.' : 'Margins stayed in a healthy band.');
  bits.push(smPct < 0.032 ? 'Sales efficiency looked strong.' : 'Sales and marketing spend ran heavy.');
  bits.push(serviceScore > 82 ? 'Service execution helped retention.' : utilization > 95 ? 'Tight capacity created service drag.' : 'Service held up.');
  if (event) bits.push(`Event: ${event.text}`);
  return bits.join(' ');
}
