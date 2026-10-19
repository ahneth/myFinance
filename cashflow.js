/**
 * ============================================================================
 * myFinance - Yearly Cashflows & Forecast Module (cashflow.js)
 * Auto-calculates year-by-year cashflows, inflation-adjusted spendings,
 * pension inflows, cash returns, and capital growth from Current Age to Decease.
 *
 * Core Model:
 * - Initial Savings entered right after Current Age.
 * - Expected Pension entered right after Target Retirement Age.
 * - During working years, the remaining amount after the income investment
 *   percentage is all spent: Spent = Income * (1 - Investment%), so Net Cash
 *   Inflow added to Savings = Income * Investment%.
 * - At Target Retirement Age (age === retirementAge), the one-time lump-sum
 *   Expected Pension is added as a cash inflow. During all retirement years
 *   (age >= retirementAge), Cash Outflow is Yearly Spending in Retirement (PV)
 *   grown by Expected Inflation Rate.
 * - All remaining Savings after cash inflows and outflows
 *   (RemainingSavings = BeginSavings + NetCashInflowOutflow) are subject to
 *   Yearly Cash Return Rate and Yearly Capital Growth Rate.
 * ============================================================================
 */
(function (global) {
  'use strict';

  const myFinance = (global.myFinance = global.myFinance || {});

  const INPUT_IDS = [
    { key: 'currentAge', id: 'cf-current-age', type: 'int' },
    { key: 'initialSavings', id: 'cf-starting-savings', type: 'float' },
    { key: 'yearlyIncome', id: 'cf-yearly-income', type: 'float' },
    { key: 'incomeGrowthRate', id: 'cf-income-growth', type: 'float' },
    { key: 'investmentPercentage', id: 'cf-investment-pct', type: 'float' },
    { key: 'cashReturnRate', id: 'cf-cash-return-rate', type: 'float' },
    { key: 'capitalGrowthRate', id: 'cf-capital-growth-rate', type: 'float' },
    { key: 'inflationRate', id: 'cf-inflation-rate', type: 'float' },
    { key: 'retirementAge', id: 'cf-retirement-age', type: 'int' },
    { key: 'expectedPension', id: 'cf-expected-pension', type: 'float' },
    { key: 'retirementSpendingPV', id: 'cf-retirement-spending-pv', type: 'float' },
    { key: 'lifeExpectancy', id: 'cf-life-expectancy', type: 'int' }
  ];

  function formatMoney(amount) {
    const val = Number(amount) || 0;
    const sign = val < 0 ? '-' : '';
    return sign + '$' + Math.abs(Math.round(val)).toLocaleString('en-US');
  }

  function populateInputsFromState() {
    const p = myFinance.Storage.getState().cashflowParams;
    INPUT_IDS.forEach(function (item) {
      const el = document.getElementById(item.id);
      if (el && p[item.key] !== undefined) {
        el.value = p[item.key];
      }
    });
  }

  function readInputsToState() {
    const state = myFinance.Storage.getState();
    const p = state.cashflowParams;

    INPUT_IDS.forEach(function (item) {
      const el = document.getElementById(item.id);
      if (!el) return;
      const rawVal = item.type === 'int' ? parseInt(el.value, 10) : parseFloat(el.value);
      if (Number.isFinite(rawVal)) {
        p[item.key] = rawVal;
      }
    });

    // Keep startingSavings alias in sync with initialSavings
    p.startingSavings = p.initialSavings;

    // Enforce logical age ordering
    if (p.currentAge < 18) p.currentAge = 18;
    if (p.retirementAge <= p.currentAge) p.retirementAge = p.currentAge + 1;
    if (p.lifeExpectancy <= p.retirementAge) p.lifeExpectancy = p.retirementAge + 1;
    if (p.lifeExpectancy > 120) p.lifeExpectancy = 120;

    myFinance.Storage.save();
  }

  function computeForecast() {
    const p = myFinance.Storage.getState().cashflowParams;
    const startYear = new Date().getFullYear();
    const horizon = Math.max(1, p.lifeExpectancy - p.currentAge);

    const incGrowth = (Number(p.incomeGrowthRate) || 0) / 100;
    const invPct = (Number(p.investmentPercentage) || 0) / 100;
    const cashRate = (Number(p.cashReturnRate) || 0) / 100;
    const capGrowthRate = (Number(p.capitalGrowthRate) || 0) / 100;
    const infRate = (Number(p.inflationRate) || 0) / 100;
    const expectedPension = Math.max(0, Number(p.expectedPension) || 0);

    let currentSavings =
      Number(p.initialSavings !== undefined ? p.initialSavings : p.startingSavings) || 0;
    const rows = [];

    let retirementNestEggNominal = null;
    let retirementNestEggPV = null;
    let firstRetirementSpending = null;
    let firstRetirementPension = null;
    let depletionAge = null;

    for (let t = 0; t <= horizon; t++) {
      const year = startYear + t;
      const age = p.currentAge + t;
      const isRetired = age >= p.retirementAge;
      const phase = isRetired ? 'Retirement' : 'Working';

      const beginSavings = currentSavings;
      const inflationFactor = Math.pow(1 + infRate, t);

      // 1. Cash Inflows (Working Income vs. One-Time Lump Sum Expected Pension at Retirement Age)
      const income = isRetired ? 0 : p.yearlyIncome * Math.pow(1 + incGrowth, t);
      const pension = age === p.retirementAge ? expectedPension : 0;

      // 2. Cash Outflows (Spent Amount)
      // - Working years: remaining amount after income investment percentage is all spent
      // - Retirement years: Yearly Spending in Retirement (PV) grown by inflation rate
      const inflationAdjustedRetirementSpending = p.retirementSpendingPV * inflationFactor;
      const activeSavings = isRetired ? 0 : income * invPct;
      const spending = isRetired ? inflationAdjustedRetirementSpending : income * (1 - invPct);

      // 3. Net Cash Inflow / Outflow into Savings before investment returns
      // - Working: Income - WorkingSpending = activeSavings (Income * invPct)
      // - Retirement: LumpSumPension (at age === retirementAge, else 0) - RetirementSpending
      const netInflowOutflow = isRetired ? pension - spending : activeSavings;

      // 4. All remaining Savings after cash inflows and outflows are subject to
      //    yearly cash return and yearly capital growth
      const remainingSavings = beginSavings + netInflowOutflow;
      const productiveBase = Math.max(0, remainingSavings);
      const cashReturn = productiveBase * cashRate;
      const capitalGrowth = productiveBase * capGrowthRate;

      // 5. Total Net Change in Savings & Ending Savings
      const netCashflow = netInflowOutflow + cashReturn + capitalGrowth;
      const endSavings = remainingSavings + cashReturn + capitalGrowth;
      const endSavingsPV = endSavings / Math.pow(1 + infRate, t + 1);

      if (age === p.retirementAge) {
        retirementNestEggNominal = beginSavings + pension;
        retirementNestEggPV = (beginSavings + pension) / inflationFactor;
        firstRetirementSpending = inflationAdjustedRetirementSpending;
        firstRetirementPension = pension;
      }

      if (endSavings < 0 && depletionAge === null) {
        depletionAge = age;
      }

      rows.push({
        t,
        year,
        age,
        isRetired,
        phase,
        beginSavings,
        income,
        pension,
        activeSavings,
        spending,
        netInflowOutflow,
        remainingSavings,
        cashReturn,
        capitalGrowth,
        netCashflow,
        endSavings,
        endSavingsPV
      });

      currentSavings = endSavings;
    }

    const finalRow = rows[rows.length - 1] || {
      endSavings: 0,
      endSavingsPV: 0,
      age: p.lifeExpectancy
    };

    return {
      params: p,
      rows: rows,
      retirementNestEggNominal:
        retirementNestEggNominal !== null ? retirementNestEggNominal : finalRow.endSavings,
      retirementNestEggPV:
        retirementNestEggPV !== null ? retirementNestEggPV : finalRow.endSavingsPV,
      firstRetirementSpending: firstRetirementSpending || 0,
      firstRetirementPension: firstRetirementPension || 0,
      finalEstateNominal: finalRow.endSavings,
      finalEstatePV: finalRow.endSavingsPV,
      depletionAge: depletionAge
    };
  }

  function renderForecastSummary(forecast) {
    const p = forecast.params;
    const retEggEl = document.getElementById('cf-kpi-ret-nest-egg');
    const retEggSubEl = document.getElementById('cf-kpi-ret-nest-egg-sub');
    const retSpendEl = document.getElementById('cf-kpi-ret-spending');
    const retSpendSubEl = document.getElementById('cf-kpi-ret-spending-sub');
    const finalEl = document.getElementById('cf-kpi-final-estate');
    const finalSubEl = document.getElementById('cf-kpi-final-estate-sub');
    const statusEl = document.getElementById('cf-kpi-sustainability');
    const statusSubEl = document.getElementById('cf-kpi-sustainability-sub');

    if (retEggEl) retEggEl.textContent = formatMoney(forecast.retirementNestEggNominal);
    if (retEggSubEl) {
      retEggSubEl.textContent =
        'At Age ' +
        p.retirementAge +
        ' (incl. ' + formatMoney(p.expectedPension) + ' pension) • PV: ' +
        formatMoney(forecast.retirementNestEggPV);
    }

    if (retSpendEl) retSpendEl.textContent = formatMoney(forecast.firstRetirementSpending) + '/yr';
    if (retSpendSubEl) {
      retSpendSubEl.textContent =
        'Lump-Sum Pension: ' +
        formatMoney(p.expectedPension) +
        ' • Spending PV: ' +
        formatMoney(p.retirementSpendingPV);
    }

    if (finalEl) {
      finalEl.textContent = formatMoney(forecast.finalEstateNominal);
      finalEl.className =
        'mt-2 text-2xl sm:text-3xl font-bold tracking-tight tabular-nums ' +
        (forecast.finalEstateNominal >= 0 ? 'text-indigo-600' : 'text-rose-600');
    }
    if (finalSubEl) {
      finalSubEl.textContent =
        'At Age ' + p.lifeExpectancy + ' • PV: ' + formatMoney(forecast.finalEstatePV);
    }

    if (statusEl && statusSubEl) {
      if (forecast.depletionAge === null) {
        statusEl.textContent = 'Sustainable ✓';
        statusEl.className = 'mt-2 text-2xl sm:text-3xl font-bold tracking-tight tabular-nums text-emerald-600';
        statusSubEl.textContent =
          'Savings last through Age ' +
          p.lifeExpectancy +
          ' (' +
          (p.cashReturnRate + p.capitalGrowthRate).toFixed(1) +
          '% combined return)';
      } else {
        statusEl.textContent = 'Shortfall @ Age ' + forecast.depletionAge;
        statusEl.className = 'mt-2 text-2xl sm:text-3xl font-bold tracking-tight tabular-nums text-rose-600';
        statusSubEl.textContent =
          'Portfolio turns negative at Age ' +
          forecast.depletionAge +
          ' — adjust savings %, pension, or retirement age';
      }
    }
  }

  function renderForecastTable(forecast) {
    const tbody = document.getElementById('cashflow-forecast-tbody');
    if (!tbody) return;

    const filterEl = document.getElementById('cf-phase-filter');
    const phaseFilter = filterEl ? filterEl.value : 'ALL';

    const rows = forecast.rows.filter(function (r) {
      if (phaseFilter === 'ALL') return true;
      return r.phase.toUpperCase() === phaseFilter;
    });

    tbody.innerHTML = rows
      .map(function (r) {
        const isRetRow = r.age === forecast.params.retirementAge;
        const rowHighlight = isRetRow
          ? 'bg-indigo-50/90 border-y-2 border-indigo-200'
          : r.isRetired
          ? 'bg-amber-50/25 border-b border-slate-100'
          : 'border-b border-slate-100';

        const phaseBadge = r.isRetired
          ? '<span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800">Retired</span>'
          : '<span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-100 text-sky-800">Working</span>';

        const inflowDisplay = r.isRetired
          ? r.pension > 0
            ? '<span class="text-sky-700" title="One-Time Lump Sum Expected Pension at Retirement Age">' + formatMoney(r.pension) + '</span>'
            : '—'
          : formatMoney(r.income);

        return (
          '<tr class="' + rowHighlight + ' hover:bg-slate-100/70 transition-colors text-xs sm:text-sm">' +
            '<td class="py-2.5 px-3 font-mono text-slate-600">' + r.year + '</td>' +
            '<td class="py-2.5 px-3 font-semibold text-slate-900">' +
              r.age +
              (isRetRow ? ' 🎯' : '') +
            '</td>' +
            '<td class="py-2.5 px-3">' + phaseBadge + '</td>' +
            '<td class="py-2.5 px-3 text-right font-mono text-slate-700">' + formatMoney(r.beginSavings) + '</td>' +
            '<td class="py-2.5 px-3 text-right font-mono text-slate-700">' + inflowDisplay + '</td>' +
            '<td class="py-2.5 px-3 text-right font-mono text-rose-600">-' + formatMoney(r.spending) + '</td>' +
            '<td class="py-2.5 px-3 text-right font-mono font-medium ' +
              (r.netInflowOutflow >= 0 ? 'text-sky-700' : 'text-rose-600') +
            '">' +
              (r.netInflowOutflow >= 0 ? '+' : '') + formatMoney(r.netInflowOutflow) +
            '</td>' +
            '<td class="py-2.5 px-3 text-right font-mono font-semibold text-slate-800 bg-slate-50/80">' +
              formatMoney(r.remainingSavings) +
            '</td>' +
            '<td class="py-2.5 px-3 text-right font-mono text-emerald-600">+' + formatMoney(r.cashReturn) + '</td>' +
            '<td class="py-2.5 px-3 text-right font-mono text-indigo-600">+' + formatMoney(r.capitalGrowth) + '</td>' +
            '<td class="py-2.5 px-3 text-right font-mono font-bold ' +
              (r.endSavings >= 0 ? 'text-slate-900' : 'text-rose-600') +
            '">' +
              formatMoney(r.endSavings) +
            '</td>' +
            '<td class="py-2.5 px-3 text-right font-mono text-teal-700">' + formatMoney(r.endSavingsPV) + '</td>' +
          '</tr>'
        );
      })
      .join('');
  }

  function refreshAll(logEvent) {
    const forecast = computeForecast();
    renderForecastSummary(forecast);
    renderForecastTable(forecast);
    if (myFinance.Charts && myFinance.Charts.renderCashflowCharts) {
      myFinance.Charts.renderCashflowCharts(forecast);
    }
    if (logEvent) {
      myFinance.Logger.info('Cashflow', 'Recalculated yearly cashflow forecast (Age ' +
        forecast.params.currentAge + ' to ' + forecast.params.lifeExpectancy + ').', {
        initialSavings: Math.round(forecast.params.initialSavings),
        expectedPension: Math.round(forecast.params.expectedPension),
        retirementNestEggNominal: Math.round(forecast.retirementNestEggNominal),
        finalEstateNominal: Math.round(forecast.finalEstateNominal),
        depletionAge: forecast.depletionAge
      });
    }
  }

  function bindEvents() {
    INPUT_IDS.forEach(function (item) {
      const el = document.getElementById(item.id);
      if (!el) return;
      el.addEventListener('input', function () {
        readInputsToState();
        refreshAll(false);
      });
      el.addEventListener('change', function () {
        readInputsToState();
        populateInputsFromState();
        refreshAll(true);
      });
    });

    const filterEl = document.getElementById('cf-phase-filter');
    if (filterEl) {
      filterEl.addEventListener('change', function () {
        refreshAll(false);
      });
    }

    // Sync Initial Savings from Balance Sheet Productive Assets
    const syncBtn = document.getElementById('btn-sync-from-bs');
    if (syncBtn) {
      syncBtn.addEventListener('click', function () {
        if (!myFinance.BalanceSheet) return;
        const bs = myFinance.BalanceSheet.computeSummary();
        const state = myFinance.Storage.getState();
        const syncedVal = Math.max(0, Math.round(bs.productiveAssets));
        state.cashflowParams.initialSavings = syncedVal;
        state.cashflowParams.startingSavings = syncedVal;
        myFinance.Storage.save();
        populateInputsFromState();
        refreshAll(true);
        myFinance.Logger.info(
          'Cashflow',
          'Synced Initial Savings with Productive Assets from Balance Sheet ($' +
            syncedVal.toLocaleString() +
            ').'
        );
        if (myFinance.App && myFinance.App.showToast) {
          myFinance.App.showToast(
            'Synced Initial Savings to Productive Assets ($' +
              syncedVal.toLocaleString() +
              ')',
            'success'
          );
        }
      });
    }
  }

  myFinance.Cashflow = {
    init: function () {
      populateInputsFromState();
      bindEvents();
      refreshAll(true);
      myFinance.Logger.info('Cashflow', 'Yearly Cashflows & Forecast module initialized.');
    },
    computeForecast: computeForecast,
    populateInputs: populateInputsFromState,
    refresh: refreshAll
  };
})(window);
