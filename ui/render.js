import { GAME_CONFIG } from '../config/gameConfig.js';

const fmtMoney = (n) => `$${Math.round(n).toLocaleString()}`;
const fmtPct = (n) => `${(n * 100).toFixed(1)}%`;

export function renderPlan(app, state, plan, onChange, onSimulate) {
  const r = state.lastResult;
  app.innerHTML = `
    <section class="card">
      <h2>Period ${state.period} of ${GAME_CONFIG.periods} · Plan Phase</h2>
      ${state.period === 1 ? `<div class="tutorial"><strong>Quick Tutorial:</strong> Gross margin is the % left after product cost/spoilage. S&M % is your customer growth engine but too high hurts EBITDA. Service score drives retention, and valuation is Annualized EBITDA × Multiple.</div>` : ''}
      <div class="kpi-row">
        <div class="kpi"><div class="label">Revenue (last period)</div><div class="value">${fmtMoney(r.revenue)}</div></div>
        <div class="kpi"><div class="label">Gross Margin %</div><div class="value">${fmtPct(r.pnl.gmPct ?? state.grossMarginPct)}</div></div>
        <div class="kpi"><div class="label">S&M %</div><div class="value">${fmtPct(r.smExpense / r.revenue)}</div></div>
      </div>
      <div class="kpi-row">
        <div class="kpi"><div class="label">Service Score</div><div class="value">${state.serviceScore.toFixed(0)}</div></div>
        <div class="kpi"><div class="label">Capacity Utilization</div><div class="value">${r.capacityUtilization.toFixed(0)}%</div></div>
        <div class="kpi"><div class="label">Valuation</div><div class="value">${fmtMoney(r.valuation.value)}</div></div>
      </div>
      <p class="small">Sysco pressure index: ${(state.syscoPressure * 100).toFixed(0)} / 100</p>
    </section>

    <section class="card">
      <h3>Decisions</h3>
      <div class="controls">
        ${selectControl('targetFocus', 'Target Focus', ['Independent', 'Chains', 'Institutions', 'Retail'], plan.targetFocus, 'Acquisition ↑ in selected segment, spend/customer mix shifts.')}
        ${selectControl('pricing', 'Pricing Posture', ['Aggressive', 'Balanced', 'Premium'], plan.pricing, 'Aggressive: Acquisition ↑ GM ↓. Premium: GM ↑, churn risk if service weak.')}
        ${rangeControl('marketingPct', 'Acquisition Marketing (% of revenue)', 0.005, 0.04, 0.0005, plan.marketingPct, 'S&M expense ↑, acquisition ↑.')}
        ${numberControl('hireReps', 'Hire Sales Reps (+)', 0, 2, 1, plan.hireReps, 'Fixed sales payroll ↑, acquisition/productivity ↑.')}
        ${selectControl('mixFocus', 'Mix Focus', ['Value', 'Balanced', 'Premium'], plan.mixFocus, 'Premium can improve GM and spend but spoilage risk ↑.')}
        ${selectControl('supplierQuality', 'Supplier Quality', ['Cheapest', 'Balanced', 'Reliable'], plan.supplierQuality, 'Cheapest: GM ↑ but service risk. Reliable: service ↑.')}
        ${selectControl('spoilageControl', 'Spoilage Control', ['Low', 'Med', 'High'], plan.spoilageControl, 'Higher investment lowers spoilage, supports GM%.')}
        ${selectControl('serviceTarget', 'Service Level Target', ['Low', 'Med', 'High'], plan.serviceTarget, 'Service ↑ improves retention/acquisition but cost ↑.')}
        ${selectControl('capacityInvestment', 'Capacity Investment', ['None', 'Small', 'Medium'], plan.capacityInvestment, 'Prevents growth caps, fixed costs ↑.')}
      </div>
      <div class="footer-actions">
        <button id="runSim">Run Simulation</button>
      </div>
    </section>
  `;

  app.querySelectorAll('[data-field]').forEach((el) => {
    el.addEventListener('change', (e) => onChange(e.target.dataset.field, e.target.value));
    if (el.type === 'range') {
      el.addEventListener('input', (e) => onChange(e.target.dataset.field, Number(e.target.value)));
    }
  });
  app.querySelector('#runSim').addEventListener('click', onSimulate);
}

export function renderSim(app, result, progress) {
  app.innerHTML = `
    <section class="card sim-wrap">
      <h2>Period Simulation</h2>
      <canvas id="simCanvas" width="900" height="420"></canvas>
      <div>${progress < 1 ? `Running operations... ${(progress * 100).toFixed(0)}%` : 'Results incoming...'}</div>
      ${result.event && progress > 0.45 && progress < 0.75 ? `<div class="event-toast">${result.event.name}</div>` : ''}
    </section>
  `;
}

export function drawCanvas(canvas, state, result, progress) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#e8f1eb';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#c7dbcf';
  ctx.fillRect(0, 330, canvas.width, 90);

  // Warehouse
  ctx.fillStyle = '#648a73';
  ctx.fillRect(70, 130, 200, 160);
  ctx.fillStyle = '#3f5f4e';
  ctx.fillRect(120, 90, 100, 45);
  ctx.fillStyle = '#fff';
  ctx.fillText('SFF DC', 147, 118);

  // Trucks moving
  const truckX = 300 + progress * 450;
  for (let i = 0; i < 2; i++) {
    ctx.fillStyle = '#00935e';
    ctx.fillRect(truckX - i * 140, 280 - i * 20, 100, 36);
    ctx.fillStyle = '#2e3330';
    ctx.fillRect(truckX + 74 - i * 140, 290 - i * 20, 22, 14);
  }

  // customers icons
  const happy = Math.round((result.retainedPct - 0.75) * 40);
  for (let i = 0; i < 12; i++) {
    const x = 640 + (i % 6) * 35;
    const y = 140 + Math.floor(i / 6) * 48;
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fillStyle = i < happy ? '#00935e' : '#b0b8b4';
    ctx.fill();
  }

  meter(ctx, 'Customers', 40, 30, Math.min((state.customers / state.capacity) * 100, 100), '#00935e');
  meter(ctx, 'Revenue', 40, 56, Math.min((result.revenue / 3500000) * 100, 100), '#00935e');
  meter(ctx, 'GM%', 40, 82, Math.min(result.pnl.gmPct * 400, 100), progress > 0.9 && result.pnl.gmPct > 0.2 ? '#8ded95' : '#00935e');
  meter(ctx, 'S&M%', 40, 108, Math.min((result.smExpense / result.revenue) * 1800, 100), '#2e3330');
  meter(ctx, 'Service', 40, 134, result.retainedPct * 100, '#00935e');
}

function meter(ctx, label, x, y, pct, color) {
  ctx.fillStyle = '#2e3330';
  ctx.fillText(label, x, y);
  ctx.fillStyle = '#d4dbd7';
  ctx.fillRect(x + 100, y - 10, 180, 10);
  ctx.fillStyle = color;
  ctx.fillRect(x + 100, y - 10, Math.max(0, Math.min(pct, 100)) * 1.8, 10);
}

export function renderResults(app, state, onNext, onReplay) {
  const r = state.lastResult;
  const smPct = r.smExpense / r.revenue;

  app.innerHTML = `
    <section class="card">
      <h2>Period ${state.period - 1} Results</h2>
      <div class="grid">
        <div class="card">
          <h3>P&L</h3>
          <table class="table">
            <tr><td>Revenue</td><td>${fmtMoney(r.revenue)}</td></tr>
            <tr><td>Gross Profit</td><td>${fmtMoney(r.grossProfit)}</td></tr>
            <tr><td>S&M Expense</td><td>${fmtMoney(r.smExpense)}</td></tr>
            <tr><td>Operating Costs</td><td>${fmtMoney(r.operating)}</td></tr>
            <tr><td><strong>EBITDA</strong></td><td class="${r.ebitda >= 0 ? 'positive' : 'negative'}"><strong>${fmtMoney(r.ebitda)}</strong></td></tr>
          </table>
        </div>
        <div class="card">
          <h3>Core KPIs</h3>
          <table class="table">
            <tr><td>Acquired Customers</td><td>${r.acquisition}</td></tr>
            <tr><td>Gross Margin %</td><td>${fmtPct(r.pnl.gmPct)}</td></tr>
            <tr><td>S&M % of Revenue</td><td>${fmtPct(smPct)}</td></tr>
            <tr><td>Active Customers</td><td>${state.customers}</td></tr>
            <tr><td>Retention %</td><td>${fmtPct(r.retainedPct)}</td></tr>
            <tr><td>Service Score</td><td>${state.serviceScore.toFixed(0)}</td></tr>
            <tr><td>Capacity Utilization</td><td>${r.capacityUtilization.toFixed(1)}%</td></tr>
          </table>
        </div>
      </div>
    </section>

    <section class="card">
      <h3>Valuation Math</h3>
      <table class="table">
        <tr><td>Annualized EBITDA</td><td>${fmtMoney(r.valuation.annualizedEbitda)}</td></tr>
        <tr><td>Base multiple</td><td>${r.valuation.baseMultiple.toFixed(1)}x</td></tr>
        <tr><td>Growth adjustment</td><td>${signedX(r.valuation.growthAdj)}</td></tr>
        <tr><td>GM adjustment</td><td>${signedX(r.valuation.gmAdj)}</td></tr>
        <tr><td>Retention adjustment</td><td>${signedX(r.valuation.retentionAdj)}</td></tr>
        <tr><td>Service adjustment</td><td>${signedX(r.valuation.serviceAdj)}</td></tr>
        <tr><td><strong>Final multiple</strong></td><td><strong>${r.valuation.multiple.toFixed(2)}x</strong></td></tr>
        <tr><td><strong>Enterprise Value</strong></td><td><strong>${fmtMoney(r.valuation.value)}</strong></td></tr>
      </table>
      <p>${r.narrative}</p>
      <div class="footer-actions">
        ${state.period <= GAME_CONFIG.periods ? '<button id="nextPeriod">Next Period</button>' : '<button id="replay">Play Again</button>'}
      </div>
    </section>
  `;

  const nextBtn = app.querySelector('#nextPeriod');
  if (nextBtn) nextBtn.addEventListener('click', onNext);
  const replayBtn = app.querySelector('#replay');
  if (replayBtn) replayBtn.addEventListener('click', onReplay);
}

function signedX(v) {
  const s = v >= 0 ? '+' : '-';
  return `${s}${Math.abs(v).toFixed(2)}x`;
}

function selectControl(key, label, options, value, hint) {
  return `<div class="control"><label>${label}</label><select data-field="${key}">${options
    .map((o) => `<option ${o === value ? 'selected' : ''} value="${o}">${o}</option>`)
    .join('')}</select><div class="hint">${hint}</div></div>`;
}

function rangeControl(key, label, min, max, step, value, hint) {
  return `<div class="control"><label>${label} <strong>${(value * 100).toFixed(2)}%</strong></label><input data-field="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" /><div class="hint">${hint}</div></div>`;
}

function numberControl(key, label, min, max, step, value, hint) {
  return `<div class="control"><label>${label}</label><input data-field="${key}" type="number" min="${min}" max="${max}" step="${step}" value="${value}" /><div class="hint">${hint}</div></div>`;
}
