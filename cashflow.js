/**
 * ============================================================================
 * myFinance - Yearly Cashflows & Forecast Module (cashflow.js)
 * Auto-calculates year-by-year cashflows, inflation-adjusted spendings,
 * pension inflows, annual cash returns, and annual capital gains from
 * Current Age to Decease.
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
 *   Yearly Cash Return Rate and Yearly Capital Growth Rate (auto-summed into
 *   Total Return Rate).
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

  function updateTotalReturnDisplay() {
    const p = myFinance.Storage.getState().cashflowParams;
    const cashRate = Number(p.cashReturnRate) || 0;
    const capRate = Number(p.capitalGrowthRate) || 0;
    const totalRate = cashRate + capRate;


    const totalBadgeEl = document.getElementById('cf-total-return-badge');
    if (totalBadgeEl) {
      totalBadgeEl.textContent =
        'Total Return Rate: ' +
        totalRate.toFixed(2) +
        '%/yr (' +
        cashRate.toFixed(2) +
        '% Cash + ' +
        capRate.toFixed(2) +
        '% Cap. Growth)';
    }
  }

  function populateInputsFromState() {
    const p = myFinance.Storage.getState().cashflowParams;
    INPUT_IDS.forEach(function (item) {
      const el = document.getElementById(item.id);
      if (el && p[item.key] !== undefined) {
        el.value = p[item.key];
      }
    });
    updateTotalReturnDisplay();
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

    updateTotalReturnDisplay();
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
    const totalReturnRate = (Number(p.cashReturnRate) || 0) + (Number(p.capitalGrowthRate) || 0);
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
    let cumulativeCashReturn = 0;
    let cumulativeCapitalGain = 0;

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
      const inflationAdjustedRetirementSpending = p.retirementSpendingPV * inflationFactor;
      const activeSavings = isRetired ? 0 : income * invPct;
      const spending = isRetired ? inflationAdjustedRetirementSpending : income * (1 - invPct);

      // 3. Net Cash Inflow / Outflow into Savings before investment returns
      const netInflowOutflow = isRetired ? pension - spending : activeSavings;

      // 4. All remaining Savings after cash inflows and outflows are subject to
      //    yearly cash return rate and yearly capital growth rate
      const remainingSavings = beginSavings + netInflowOutflow;
      const productiveBase = Math.max(0, remainingSavings);
      const cashReturn = productiveBase * cashRate;
      const capitalGrowth = productiveBase * capGrowthRate;
      const totalInvestmentReturn = cashReturn + capitalGrowth;

      cumulativeCashReturn += cashReturn;
      cumulativeCapitalGain += capitalGrowth;

      // 5. Total Net Change in Savings & Ending Savings
      const netCashflow = netInflowOutflow + totalInvestmentReturn;
      const endSavings = remainingSavings + totalInvestmentReturn;
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
        totalInvestmentReturn,
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
      totalReturnRate: totalReturnRate,
      rows: rows,
      retirementNestEggNominal:
        retirementNestEggNominal !== null ? retirementNestEggNominal : finalRow.endSavings,
      retirementNestEggPV:
        retirementNestEggPV !== null ? retirementNestEggPV : finalRow.endSavingsPV,
      firstRetirementSpending: firstRetirementSpending || 0,
      firstRetirementPension: firstRetirementPension || 0,
      finalEstateNominal: finalRow.endSavings,
      finalEstatePV: finalRow.endSavingsPV,
      cumulativeCashReturn: cumulativeCashReturn,
      cumulativeCapitalGain: cumulativeCapitalGain,
      cumulativeTotalReturn: cumulativeCashReturn + cumulativeCapitalGain,
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
        'At Age ' +
        p.lifeExpectancy +
        ' • PV: ' +
        formatMoney(forecast.finalEstatePV) +
        ' • Cash Ret: +' +
        formatMoney(forecast.cumulativeCashReturn) +
        ' | Cap Gain: +' +
        formatMoney(forecast.cumulativeCapitalGain);
    }

    if (statusEl && statusSubEl) {
      const cashR = (Number(p.cashReturnRate) || 0).toFixed(2);
      const capR = (Number(p.capitalGrowthRate) || 0).toFixed(2);
      const totR = ((Number(p.cashReturnRate) || 0) + (Number(p.capitalGrowthRate) || 0)).toFixed(2);
      if (forecast.depletionAge === null) {
        statusEl.textContent = 'Sustainable ✓';
        statusEl.className = 'mt-2 text-2xl sm:text-3xl font-bold tracking-tight tabular-nums text-emerald-600';
        statusSubEl.textContent =
          'Through Age ' +
          p.lifeExpectancy +
          ' (' +
          totR +
          '% Total = ' +
          cashR +
          '% Cash + ' +
          capR +
          '% Growth)';
      } else {
        statusEl.textContent = 'Shortfall @ Age ' + forecast.depletionAge;
        statusEl.className = 'mt-2 text-2xl sm:text-3xl font-bold tracking-tight tabular-nums text-rose-600';
        statusSubEl.textContent =
          'Turns negative at Age ' +
          forecast.depletionAge +
          ' (' +
          totR +
          '% Total = ' +
          cashR +
          '% Cash + ' +
          capR +
          '% Growth)';
      }
    }
  }

  function renderForecastTable(forecast) {
    const tbody = document.getElementById('cashflow-forecast-tbody');
    const tfoot = document.getElementById('cashflow-forecast-tfoot');
    if (!tbody) return;

    const filterEl = document.getElementById('cf-phase-filter');
    const phaseFilter = filterEl ? filterEl.value : 'ALL';

    const rows = forecast.rows.filter(function (r) {
      if (phaseFilter === 'ALL') return true;
      return r.phase.toUpperCase() === phaseFilter;
    });

    let sumInflow = 0;
    let sumSpending = 0;
    let sumNetFlow = 0;
    let sumCashReturn = 0;
    let sumCapGain = 0;

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

        sumInflow += r.isRetired ? r.pension : r.income;
        sumSpending += r.spending;
        sumNetFlow += r.netInflowOutflow;
        sumCashReturn += r.cashReturn;
        sumCapGain += r.capitalGrowth;

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
            '<td class="py-2.5 px-3 text-right font-mono text-purple-600">+' + formatMoney(r.capitalGrowth) + '</td>' +
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

    if (tfoot && rows.length > 0) {
      const lastRow = rows[rows.length - 1];
      tfoot.innerHTML =
        '<tr class="bg-slate-100/95 border-t-2 border-slate-300 text-xs font-bold text-slate-900 font-mono">' +
          '<td class="py-2.5 px-3 font-sans" colspan="4">Cumulative Horizon Totals (' + rows.length + ' yrs)</td>' +
          '<td class="py-2.5 px-3 text-right text-slate-800">' + formatMoney(sumInflow) + '</td>' +
          '<td class="py-2.5 px-3 text-right text-rose-600">-' + formatMoney(sumSpending) + '</td>' +
          '<td class="py-2.5 px-3 text-right ' + (sumNetFlow >= 0 ? 'text-sky-700' : 'text-rose-600') + '">' +
            (sumNetFlow >= 0 ? '+' : '') + formatMoney(sumNetFlow) +
          '</td>' +
          '<td class="py-2.5 px-3 text-right text-slate-500">—</td>' +
          '<td class="py-2.5 px-3 text-right text-emerald-700">+' + formatMoney(sumCashReturn) + '</td>' +
          '<td class="py-2.5 px-3 text-right text-purple-700">+' + formatMoney(sumCapGain) + '</td>' +
          '<td class="py-2.5 px-3 text-right ' + (lastRow.endSavings >= 0 ? 'text-slate-900' : 'text-rose-600') + '">' +
            formatMoney(lastRow.endSavings) +
          '</td>' +
          '<td class="py-2.5 px-3 text-right text-teal-700">' + formatMoney(lastRow.endSavingsPV) + '</td>' +
        '</tr>';
    } else if (tfoot) {
      tfoot.innerHTML = '';
    }
  }

  function refreshAll(logEvent) {
    const forecast = computeForecast();
    updateTotalReturnDisplay();
    renderForecastSummary(forecast);
    renderForecastTable(forecast);
    if (myFinance.Charts && myFinance.Charts.renderCashflowCharts) {
      myFinance.Charts.renderCashflowCharts(forecast);
    }
    if (logEvent) {
      myFinance.Logger.info('Cashflow', 'Recalculated yearly cashflow forecast (Age ' +
        forecast.params.currentAge + ' to ' + forecast.params.lifeExpectancy + ').', {
        initialSavings: Math.round(forecast.params.initialSavings),
        cashReturnRate: forecast.params.cashReturnRate,
        capitalGrowthRate: forecast.params.capitalGrowthRate,
        totalReturnRate: Number(forecast.totalReturnRate.toFixed(2)),
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

    // Sync Initial Savings & Weighted Return Rates from Balance Sheet Productive Assets
    const syncBtn = document.getElementById('btn-sync-from-bs');
    if (syncBtn) {
      syncBtn.addEventListener('click', function () {
        if (!myFinance.BalanceSheet) return;
        const bs = myFinance.BalanceSheet.computeSummary();
        const state = myFinance.Storage.getState();
        const syncedVal = Math.max(0, Math.round(bs.productiveAssets));
        state.cashflowParams.initialSavings = syncedVal;
        state.cashflowParams.startingSavings = syncedVal;
        if (bs.productiveAssets > 0) {
          state.cashflowParams.cashReturnRate = Number(bs.weightedProductiveCashReturnRate.toFixed(2));
          state.cashflowParams.capitalGrowthRate = Number(bs.weightedProductiveCapitalGrowthRate.toFixed(2));
        }
        myFinance.Storage.save();
        populateInputsFromState();
        refreshAll(true);
        myFinance.Logger.info(
          'Cashflow',
          'Synced Initial Savings ($' +
            syncedVal.toLocaleString() +
            '), Cash Return Rate (' +
            state.cashflowParams.cashReturnRate +
            '%), and Capital Growth Rate (' +
            state.cashflowParams.capitalGrowthRate +
            '%) from Balance Sheet Productive Assets.'
        );
        if (myFinance.App && myFinance.App.showToast) {
          myFinance.App.showToast(
            'Synced Initial Savings ($' +
              syncedVal.toLocaleString() +
              ') & Return Rates (' +
              state.cashflowParams.cashReturnRate.toFixed(2) +
              '% Cash + ' +
              state.cashflowParams.capitalGrowthRate.toFixed(2) +
              '% Cap. Growth)',
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
