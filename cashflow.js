/**
 * ============================================================================
 * myFinance - Yearly Cashflows & Forecast Module (cashflow.js)
 * Auto-calculates year-by-year cashflows, inflation-adjusted spendings,
 * cash returns, and capital growth from Current Age to Age of Decease.
 * ============================================================================
 */
(function (global) {
  'use strict';

  const myFinance = (global.myFinance = global.myFinance || {});

  const INPUT_IDS = [
    { key: 'currentAge', id: 'cf-current-age', type: 'int' },
    { key: 'yearlyIncome', id: 'cf-yearly-income', type: 'float' },
    { key: 'incomeGrowthRate', id: 'cf-income-growth', type: 'float' },
    { key: 'investmentPercentage', id: 'cf-investment-pct', type: 'float' },
    { key: 'cashReturnRate', id: 'cf-cash-return-rate', type: 'float' },
    { key: 'capitalGrowthRate', id: 'cf-capital-growth-rate', type: 'float' },
    { key: 'inflationRate', id: 'cf-inflation-rate', type: 'float' },
    { key: 'retirementAge', id: 'cf-retirement-age', type: 'int' },
    { key: 'retirementSpendingPV', id: 'cf-retirement-spending-pv', type: 'float' },
    { key: 'lifeExpectancy', id: 'cf-life-expectancy', type: 'int' },
    { key: 'startingSavings', id: 'cf-starting-savings', type: 'float' }
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

    // Enforce logical age ordering
    if (p.currentAge < 18) p.currentAge = 18;
    if (p.retirementAge <= p.currentAge) p.retirementAge = p.currentAge + 1;
    if (p.lifeExpectancy <= p.retirementAge) p.lifeExpectancy = p.retirementAge + 1;
    if (p.lifeExpectancy > 120) p.lifeExpectancy = 120;

    myFinance.Storage.save();
  }

  /**
   * Year-by-year forecast engine from Current Year (Current Age) to Age of Decease:
   * - Working Years (age < retirementAge):
   *   * Yearly Income grows by Expected Income Growth Rate: Income_t = YearlyIncome * (1 + incomeGrowthRate)^t
   *   * Active Savings from Income = Income_t * (InvestmentPercentage / 100)
   *   * Implied Working Living Spending = Income_t * (1 - InvestmentPercentage / 100)
   *   * Cash Return = BeginSavings * (CashReturnRate / 100)
   *   * Capital Growth = BeginSavings * (CapitalGrowthRate / 100)
   *   * Net Cashflow Added to Savings = Active Savings + Cash Return + Capital Growth
   * - Retirement Years (age >= retirementAge):
   *   * Earned Income = 0
   *   * Future Spending in Retirement grows by Inflation Rate from Today (t years from Current Age):
   *     RetirementSpending_t = RetirementSpendingPV * (1 + inflationRate)^t
   *   * Cash Return = BeginSavings * (CashReturnRate / 100)
   *   * Capital Growth = BeginSavings * (CapitalGrowthRate / 100)
   *   * Net Cashflow = Cash Return + Capital Growth - RetirementSpending_t
   * - Ending Savings (Nominal) = BeginSavings + Net Cashflow
   * - Ending Savings (Present Value) = Ending Savings / (1 + inflationRate)^(t + 1)
   */
  function computeForecast() {
    const p = myFinance.Storage.getState().cashflowParams;
    const startYear = new Date().getFullYear();
    const horizon = Math.max(1, p.lifeExpectancy - p.currentAge);

    const incGrowth = (Number(p.incomeGrowthRate) || 0) / 100;
    const invPct = (Number(p.investmentPercentage) || 0) / 100;
    const cashRate = (Number(p.cashReturnRate) || 0) / 100;
    const capGrowthRate = (Number(p.capitalGrowthRate) || 0) / 100;
    const infRate = (Number(p.inflationRate) || 0) / 100;

    let currentSavings = Number(p.startingSavings) || 0;
    const rows = [];

    let retirementNestEggNominal = null;
    let retirementNestEggPV = null;
    let firstRetirementSpending = null;
    let firstRetirementCashReturn = null;
    let depletionAge = null;

    for (let t = 0; t <= horizon; t++) {
      const year = startYear + t;
      const age = p.currentAge + t;
      const isRetired = age >= p.retirementAge;
      const phase = isRetired ? 'Retirement' : 'Working';

      const beginSavings = currentSavings;
      const inflationFactor = Math.pow(1 + infRate, t);

      // Earned income during working years
      const income = isRetired ? 0 : p.yearlyIncome * Math.pow(1 + incGrowth, t);

      // Future retirement spending grown by inflation rate from present value
      const inflationAdjustedRetirementSpending = p.retirementSpendingPV * inflationFactor;

      // Active savings from salary during working years
      const activeSavings = isRetired ? 0 : income * invPct;

      // Working living expenses vs retirement inflation-adjusted spending
      const spending = isRetired ? inflationAdjustedRetirementSpending : income * (1 - invPct);

      // Returns on accumulated savings (only positive savings earn positive cash/capital return)
      const productiveBase = Math.max(0, beginSavings);
      const cashReturn = productiveBase * cashRate;
      const capitalGrowth = productiveBase * capGrowthRate;

      // Net impact on savings / portfolio
      const netCashflow = isRetired
        ? cashReturn + capitalGrowth - inflationAdjustedRetirementSpending
        : activeSavings + cashReturn + capitalGrowth;

      const endSavings = beginSavings + netCashflow;
      const endSavingsPV = endSavings / Math.pow(1 + infRate, t + 1);

      if (age === p.retirementAge) {
        retirementNestEggNominal = beginSavings;
        retirementNestEggPV = beginSavings / inflationFactor;
        firstRetirementSpending = inflationAdjustedRetirementSpending;
        firstRetirementCashReturn = cashReturn + capitalGrowth;
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
        activeSavings,
        spending,
        retirementBenchmarkSpending: inflationAdjustedRetirementSpending,
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
      firstRetirementCashReturn: firstRetirementCashReturn || 0,
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
        ' • PV: ' +
        formatMoney(forecast.retirementNestEggPV);
    }

    if (retSpendEl) retSpendEl.textContent = formatMoney(forecast.firstRetirementSpending) + '/yr';
    if (retSpendSubEl) {
      retSpendSubEl.textContent =
        'Today PV: ' +
        formatMoney(p.retirementSpendingPV) +
        ' @ ' +
        p.inflationRate.toFixed(1) +
        '% inflation';
    }

    if (finalEl) {
      finalEl.textContent = formatMoney(forecast.finalEstateNominal);
      finalEl.className =
        'text-2xl sm:text-3xl font-bold tracking-tight ' +
        (forecast.finalEstateNominal >= 0 ? 'text-indigo-600' : 'text-rose-600');
    }
    if (finalSubEl) {
      finalSubEl.textContent =
        'At Age ' + p.lifeExpectancy + ' • PV: ' + formatMoney(forecast.finalEstatePV);
    }

    if (statusEl && statusSubEl) {
      if (forecast.depletionAge === null) {
        statusEl.textContent = 'Sustainable ✓';
        statusEl.className = 'text-2xl sm:text-3xl font-bold tracking-tight text-emerald-600';
        statusSubEl.textContent =
          'Savings last through Age ' +
          p.lifeExpectancy +
          ' (' +
          (p.cashReturnRate + p.capitalGrowthRate).toFixed(1) +
          '% combined return)';
      } else {
        statusEl.textContent = 'Shortfall @ Age ' + forecast.depletionAge;
        statusEl.className = 'text-2xl sm:text-3xl font-bold tracking-tight text-rose-600';
        statusSubEl.textContent =
          'Portfolio turns negative at Age ' +
          forecast.depletionAge +
          ' — adjust savings % or retirement age';
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

        return (
          '<tr class="' + rowHighlight + ' hover:bg-slate-100/70 transition-colors text-xs sm:text-sm">' +
            '<td class="py-2.5 px-3 font-mono text-slate-600">' + r.year + '</td>' +
            '<td class="py-2.5 px-3 font-semibold text-slate-900">' +
              r.age +
              (isRetRow ? ' 🎯' : '') +
            '</td>' +
            '<td class="py-2.5 px-3">' + phaseBadge + '</td>' +
            '<td class="py-2.5 px-3 text-right font-mono text-slate-700">' + formatMoney(r.beginSavings) + '</td>' +
            '<td class="py-2.5 px-3 text-right font-mono text-slate-700">' +
              (r.income > 0 ? formatMoney(r.income) : '—') +
            '</td>' +
            '<td class="py-2.5 px-3 text-right font-mono text-sky-700 font-medium">' +
              (r.activeSavings > 0 ? '+' + formatMoney(r.activeSavings) : '—') +
            '</td>' +
            '<td class="py-2.5 px-3 text-right font-mono text-emerald-600">' +
              '+' + formatMoney(r.cashReturn) +
            '</td>' +
            '<td class="py-2.5 px-3 text-right font-mono text-indigo-600">' +
              '+' + formatMoney(r.capitalGrowth) +
            '</td>' +
            '<td class="py-2.5 px-3 text-right font-mono text-rose-600">' +
              formatMoney(r.spending) +
            '</td>' +
            '<td class="py-2.5 px-3 text-right font-mono font-semibold ' +
              (r.netCashflow >= 0 ? 'text-emerald-700' : 'text-rose-600') +
            '">' +
              (r.netCashflow >= 0 ? '+' : '') + formatMoney(r.netCashflow) +
            '</td>' +
            '<td class="py-2.5 px-3 text-right font-mono font-bold ' +
              (r.endSavings >= 0 ? 'text-slate-900' : 'text-rose-600') +
            '">' +
              formatMoney(r.endSavings) +
            '</td>' +
            '<td class="py-2.5 px-3 text-right font-mono text-teal-700">' +
              formatMoney(r.endSavingsPV) +
            '</td>' +
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

    // Sync Starting Savings & Weighted Return from Balance Sheet
    const syncBtn = document.getElementById('btn-sync-from-bs');
    if (syncBtn) {
      syncBtn.addEventListener('click', function () {
        if (!myFinance.BalanceSheet) return;
        const bs = myFinance.BalanceSheet.computeSummary();
        const state = myFinance.Storage.getState();
        state.cashflowParams.startingSavings = Math.max(0, Math.round(bs.productiveAssets));
        myFinance.Storage.save();
        populateInputsFromState();
        refreshAll(true);
        myFinance.Logger.info(
          'Cashflow',
          'Synced Starting Savings with Productive Assets from Balance Sheet ($' +
            Math.round(bs.productiveAssets).toLocaleString() +
            ').'
        );
        if (myFinance.App && myFinance.App.showToast) {
          myFinance.App.showToast(
            'Synced Starting Savings to Productive Assets ($' +
              Math.round(bs.productiveAssets).toLocaleString() +
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
