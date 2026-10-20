/**
 * ============================================================================
 * myFinance - Balance Sheet & Financial Ratios Module (balanceSheet.js)
 * Manages Assets (Liquid / Fixed, Productive flag, Yearly Cash Return Rate,
 * Yearly Capital Growth Rate & Auto-Calculated Total Return Rate),
 * Liabilities (Short-Term / Long-Term), Net Worth, and Financial Health Ratios.
 * ============================================================================
 */
(function (global) {
  'use strict';

  const myFinance = (global.myFinance = global.myFinance || {});

  let assetCategoryFilter = 'ALL';
  let liabilityCategoryFilter = 'ALL';
  let editingAssetId = null;
  let editingLiabilityId = null;

  function formatMoney(amount) {
    const val = Number(amount) || 0;
    const sign = val < 0 ? '-' : '';
    return sign + '$' + Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getAssetRates(asset) {
    if (!asset || !asset.productive) {
      return { cashReturnRate: 0, capitalGrowthRate: 0, totalReturnRate: 0 };
    }
    const hasSplit =
      asset.cashReturnRate !== undefined || asset.capitalGrowthRate !== undefined;
    const cashReturnRate = hasSplit
      ? Number(asset.cashReturnRate) || 0
      : Number(asset.returnRate) || 0;
    const capitalGrowthRate = hasSplit ? Number(asset.capitalGrowthRate) || 0 : 0;
    const totalReturnRate = Number((cashReturnRate + capitalGrowthRate).toFixed(4));
    return { cashReturnRate, capitalGrowthRate, totalReturnRate };
  }

  function computeSummary() {
    const state = myFinance.Storage.getState();
    const assets = state.assets || [];
    const liabilities = state.liabilities || [];

    let liquidAssets = 0;
    let fixedAssets = 0;
    let productiveAssets = 0;
    let nonProductiveAssets = 0;
    let totalAnnualCashReturn = 0;
    let totalAnnualCapitalGain = 0;
    let totalAnnualReturn = 0;

    for (let i = 0; i < assets.length; i++) {
      const a = assets[i];
      const amt = Number(a.amount) || 0;
      const rates = getAssetRates(a);

      // Keep asset properties normalized in memory
      a.cashReturnRate = rates.cashReturnRate;
      a.capitalGrowthRate = rates.capitalGrowthRate;
      a.totalReturnRate = rates.totalReturnRate;
      a.returnRate = rates.totalReturnRate;

      if (a.category === 'Liquid') liquidAssets += amt;
      else fixedAssets += amt;

      if (a.productive) {
        productiveAssets += amt;
        const cashRet = (amt * rates.cashReturnRate) / 100;
        const capGain = (amt * rates.capitalGrowthRate) / 100;
        totalAnnualCashReturn += cashRet;
        totalAnnualCapitalGain += capGain;
        totalAnnualReturn += cashRet + capGain;
      } else {
        nonProductiveAssets += amt;
      }
    }

    const totalAssets = liquidAssets + fixedAssets;

    let shortTermLiabilities = 0;
    let longTermLiabilities = 0;
    let annualDebtInterest = 0;

    for (let j = 0; j < liabilities.length; j++) {
      const l = liabilities[j];
      const amt = Number(l.amount) || 0;
      const intRate = Number(l.interestRate) || 0;
      if (l.category === 'Short-Term') shortTermLiabilities += amt;
      else longTermLiabilities += amt;
      annualDebtInterest += (amt * intRate) / 100;
    }

    const totalLiabilities = shortTermLiabilities + longTermLiabilities;
    const netWorth = totalAssets - totalLiabilities;

    // Key Financial Ratios & Split Return Metrics
    const liquidityRatio =
      shortTermLiabilities > 0
        ? liquidAssets / shortTermLiabilities
        : liquidAssets > 0
        ? 99.9
        : 0;

    const debtToAssetRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;
    const solvencyRatio = totalAssets > 0 ? (netWorth / totalAssets) * 100 : 0;
    const productiveAssetRatio = totalAssets > 0 ? (productiveAssets / totalAssets) * 100 : 0;

    const weightedProductiveCashReturnRate =
      productiveAssets > 0 ? (totalAnnualCashReturn / productiveAssets) * 100 : 0;
    const weightedProductiveCapitalGrowthRate =
      productiveAssets > 0 ? (totalAnnualCapitalGain / productiveAssets) * 100 : 0;
    const weightedProductiveYield =
      weightedProductiveCashReturnRate + weightedProductiveCapitalGrowthRate;

    const effectiveTotalAssetCashYield =
      totalAssets > 0 ? (totalAnnualCashReturn / totalAssets) * 100 : 0;
    const effectiveTotalAssetCapitalGrowth =
      totalAssets > 0 ? (totalAnnualCapitalGain / totalAssets) * 100 : 0;
    const effectiveTotalAssetYield =
      effectiveTotalAssetCashYield + effectiveTotalAssetCapitalGrowth;

    const liquidToTotalAssetRatio = totalAssets > 0 ? (liquidAssets / totalAssets) * 100 : 0;

    return {
      liquidAssets,
      fixedAssets,
      totalAssets,
      productiveAssets,
      nonProductiveAssets,
      totalAnnualCashReturn,
      totalAnnualCapitalGain,
      totalAnnualReturn,
      shortTermLiabilities,
      longTermLiabilities,
      totalLiabilities,
      annualDebtInterest,
      netWorth,
      liquidityRatio,
      debtToAssetRatio,
      solvencyRatio,
      productiveAssetRatio,
      weightedProductiveCashReturnRate,
      weightedProductiveCapitalGrowthRate,
      weightedProductiveYield,
      effectiveTotalAssetCashYield,
      effectiveTotalAssetCapitalGrowth,
      effectiveTotalAssetYield,
      liquidToTotalAssetRatio
    };
  }

  function renderSummaryCards(summary) {
    const nwEl = document.getElementById('bs-kpi-net-worth');
    const nwSubEl = document.getElementById('bs-kpi-net-worth-sub');
    const astEl = document.getElementById('bs-kpi-total-assets');
    const astSubEl = document.getElementById('bs-kpi-assets-sub');
    const libEl = document.getElementById('bs-kpi-total-liabilities');
    const libSubEl = document.getElementById('bs-kpi-liabilities-sub');
    const cashEl = document.getElementById('bs-kpi-cash-return');
    const cashSubEl = document.getElementById('bs-kpi-cash-return-sub');
    const capEl = document.getElementById('bs-kpi-capital-gain');
    const capSubEl = document.getElementById('bs-kpi-capital-gain-sub');
    const prodEl = document.getElementById('bs-kpi-productive-return');
    const prodSubEl = document.getElementById('bs-kpi-productive-sub');

    if (nwEl) {
      nwEl.textContent = formatMoney(summary.netWorth);
      nwEl.className =
        'mt-2 text-2xl sm:text-3xl font-bold tracking-tight tabular-nums ' +
        (summary.netWorth >= 0 ? 'text-white' : 'text-rose-300');
    }
    if (nwSubEl) {
      nwSubEl.textContent =
        'Solvency Ratio: ' + summary.solvencyRatio.toFixed(1) + '% net equity ownership';
    }

    if (astEl) astEl.textContent = formatMoney(summary.totalAssets);
    if (astSubEl) {
      astSubEl.textContent =
        'Liquid: ' +
        formatMoney(summary.liquidAssets) +
        ' • Fixed: ' +
        formatMoney(summary.fixedAssets);
    }

    if (libEl) libEl.textContent = formatMoney(summary.totalLiabilities);
    if (libSubEl) {
      libSubEl.textContent =
        'Short-Term: ' +
        formatMoney(summary.shortTermLiabilities) +
        ' • Long-Term: ' +
        formatMoney(summary.longTermLiabilities);
    }

    if (cashEl) {
      cashEl.textContent = '+' + formatMoney(summary.totalAnnualCashReturn) + '/yr';
    }
    if (cashSubEl) {
      cashSubEl.textContent =
        summary.weightedProductiveCashReturnRate.toFixed(2) +
        '% avg cash yield on ' +
        formatMoney(summary.productiveAssets);
    }

    if (capEl) {
      capEl.textContent = '+' + formatMoney(summary.totalAnnualCapitalGain) + '/yr';
    }
    if (capSubEl) {
      capSubEl.textContent =
        summary.weightedProductiveCapitalGrowthRate.toFixed(2) +
        '% avg cap. growth on ' +
        formatMoney(summary.productiveAssets);
    }

    if (prodEl) {
      prodEl.textContent = '+' + formatMoney(summary.totalAnnualReturn) + '/yr';
    }
    if (prodSubEl) {
      prodSubEl.textContent =
        summary.weightedProductiveYield.toFixed(2) +
        '% total (' +
        summary.weightedProductiveCashReturnRate.toFixed(2) +
        '% cash + ' +
        summary.weightedProductiveCapitalGrowthRate.toFixed(2) +
        '% growth)';
    }
  }

  function renderRatios(summary) {
    const container = document.getElementById('bs-ratios-grid');
    if (!container) return;

    const ratios = [
      {
        name: 'Liquidity (Current) Ratio',
        formula: 'Liquid Assets ÷ Short-Term Liabilities',
        valueText:
          summary.shortTermLiabilities === 0 && summary.liquidAssets > 0
            ? '∞ (No ST Debt)'
            : summary.liquidityRatio.toFixed(2) + 'x',
        status:
          summary.liquidityRatio >= 2.0
            ? { label: 'Healthy', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', bar: 'bg-emerald-500' }
            : summary.liquidityRatio >= 1.0
            ? { label: 'Moderate', cls: 'bg-amber-50 text-amber-700 border border-amber-200', bar: 'bg-amber-500' }
            : { label: 'Watch', cls: 'bg-rose-50 text-rose-700 border border-rose-200', bar: 'bg-rose-500' },
        pct: Math.min(100, Math.max(5, (summary.liquidityRatio / 4) * 100)),
        target: 'Benchmark: ≥ 2.0x short-term coverage'
      },
      {
        name: 'Debt-to-Asset Ratio',
        formula: 'Total Liabilities ÷ Total Assets',
        valueText: summary.debtToAssetRatio.toFixed(1) + '%',
        status:
          summary.debtToAssetRatio <= 35
            ? { label: 'Low Leverage', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', bar: 'bg-emerald-500' }
            : summary.debtToAssetRatio <= 60
            ? { label: 'Moderate', cls: 'bg-amber-50 text-amber-700 border border-amber-200', bar: 'bg-amber-500' }
            : { label: 'High Leverage', cls: 'bg-rose-50 text-rose-700 border border-rose-200', bar: 'bg-rose-500' },
        pct: Math.min(100, Math.max(4, summary.debtToAssetRatio)),
        target: 'Benchmark: ≤ 35.0% debt-to-assets'
      },
      {
        name: 'Solvency (Net Equity) Ratio',
        formula: 'Net Worth ÷ Total Assets',
        valueText: summary.solvencyRatio.toFixed(1) + '%',
        status:
          summary.solvencyRatio >= 65
            ? { label: 'Strong Equity', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', bar: 'bg-emerald-500' }
            : summary.solvencyRatio >= 40
            ? { label: 'Moderate', cls: 'bg-amber-50 text-amber-700 border border-amber-200', bar: 'bg-amber-500' }
            : { label: 'Low Equity', cls: 'bg-rose-50 text-rose-700 border border-rose-200', bar: 'bg-rose-500' },
        pct: Math.min(100, Math.max(0, summary.solvencyRatio)),
        target: 'Benchmark: ≥ 65.0% net equity ownership'
      },
      {
        name: 'Productive Asset Share',
        formula: 'Productive Assets ÷ Total Assets',
        valueText: summary.productiveAssetRatio.toFixed(1) + '%',
        status:
          summary.productiveAssetRatio >= 50
            ? { label: 'High Productive', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', bar: 'bg-indigo-600' }
            : summary.productiveAssetRatio >= 30
            ? { label: 'Balanced', cls: 'bg-amber-50 text-amber-700 border border-amber-200', bar: 'bg-indigo-500' }
            : { label: 'Low Productive Share', cls: 'bg-rose-50 text-rose-700 border border-rose-200', bar: 'bg-rose-500' },
        pct: Math.min(100, Math.max(0, summary.productiveAssetRatio)),
        target: formatMoney(summary.productiveAssets) + ' productive of ' + formatMoney(summary.totalAssets)
      },
      {
        name: 'Productive Cash Return Rate',
        formula: 'Annual Cash Returns ÷ Productive Assets',
        valueText: summary.weightedProductiveCashReturnRate.toFixed(2) + '%',
        status:
          summary.weightedProductiveCashReturnRate >= 3.0
            ? { label: '+' + formatMoney(summary.totalAnnualCashReturn) + '/yr', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', bar: 'bg-emerald-500' }
            : summary.weightedProductiveCashReturnRate >= 1.5
            ? { label: '+' + formatMoney(summary.totalAnnualCashReturn) + '/yr', cls: 'bg-sky-50 text-sky-700 border border-sky-200', bar: 'bg-sky-500' }
            : { label: '+' + formatMoney(summary.totalAnnualCashReturn) + '/yr', cls: 'bg-slate-100 text-slate-700 border border-slate-200', bar: 'bg-slate-400' },
        pct: Math.min(100, Math.max(5, (summary.weightedProductiveCashReturnRate / 8) * 100)),
        target: 'Effective Total Asset Cash Yield: ' + summary.effectiveTotalAssetCashYield.toFixed(2) + '%'
      },
      {
        name: 'Productive Capital Growth Rate',
        formula: 'Annual Capital Gain ÷ Productive Assets',
        valueText: summary.weightedProductiveCapitalGrowthRate.toFixed(2) + '%',
        status:
          summary.weightedProductiveCapitalGrowthRate >= 3.0
            ? { label: '+' + formatMoney(summary.totalAnnualCapitalGain) + '/yr', cls: 'bg-purple-50 text-purple-700 border border-purple-200', bar: 'bg-purple-500' }
            : summary.weightedProductiveCapitalGrowthRate >= 1.5
            ? { label: '+' + formatMoney(summary.totalAnnualCapitalGain) + '/yr', cls: 'bg-indigo-50 text-indigo-700 border border-indigo-200', bar: 'bg-indigo-500' }
            : { label: '+' + formatMoney(summary.totalAnnualCapitalGain) + '/yr', cls: 'bg-slate-100 text-slate-700 border border-slate-200', bar: 'bg-slate-400' },
        pct: Math.min(100, Math.max(5, (summary.weightedProductiveCapitalGrowthRate / 8) * 100)),
        target: 'Effective Total Asset Cap. Growth: ' + summary.effectiveTotalAssetCapitalGrowth.toFixed(2) + '%'
      },
      {
        name: 'Total Productive Return Rate',
        formula: 'Cash Return Rate + Capital Growth Rate',
        valueText: summary.weightedProductiveYield.toFixed(2) + '%',
        status:
          summary.weightedProductiveYield >= 5.0
            ? { label: '+' + formatMoney(summary.totalAnnualReturn) + '/yr', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', bar: 'bg-emerald-600' }
            : summary.weightedProductiveYield >= 2.5
            ? { label: '+' + formatMoney(summary.totalAnnualReturn) + '/yr', cls: 'bg-sky-50 text-sky-700 border border-sky-200', bar: 'bg-sky-500' }
            : { label: '+' + formatMoney(summary.totalAnnualReturn) + '/yr', cls: 'bg-slate-100 text-slate-700 border border-slate-200', bar: 'bg-slate-400' },
        pct: Math.min(100, Math.max(5, (summary.weightedProductiveYield / 10) * 100)),
        target:
          'Effective Total Asset Return: ' +
          summary.effectiveTotalAssetYield.toFixed(2) +
          '% (' +
          summary.effectiveTotalAssetCashYield.toFixed(2) +
          '% + ' +
          summary.effectiveTotalAssetCapitalGrowth.toFixed(2) +
          '%)'
      },
      {
        name: 'Liquid Asset Flexibility',
        formula: 'Liquid Assets ÷ Total Assets',
        valueText: summary.liquidToTotalAssetRatio.toFixed(1) + '%',
        status:
          summary.liquidToTotalAssetRatio >= 15
            ? { label: 'Liquid Buffer OK', cls: 'bg-sky-50 text-sky-700 border border-sky-200', bar: 'bg-sky-500' }
            : { label: 'Illiquid Heavy', cls: 'bg-amber-50 text-amber-700 border border-amber-200', bar: 'bg-amber-500' },
        pct: Math.min(100, Math.max(4, summary.liquidToTotalAssetRatio)),
        target: 'Benchmark: 15%–40% liquid reserves'
      }
    ];

    container.innerHTML = ratios
      .map(function (r) {
        return (
          '<div class="p-4 rounded-xl bg-slate-50/70 hover:bg-white border border-slate-200/80 transition-all flex flex-col justify-between shadow-2xs">' +
            '<div>' +
              '<div class="flex items-start justify-between gap-2">' +
                '<h4 class="text-xs font-semibold uppercase tracking-wider text-slate-500">' + escapeHtml(r.name) + '</h4>' +
                '<span class="px-2 py-0.5 text-[11px] font-semibold rounded-full shrink-0 tabular-nums ' + r.status.cls + '">' +
                  escapeHtml(r.status.label) +
                '</span>' +
              '</div>' +
              '<div class="mt-2 text-2xl font-bold text-slate-900 tabular-nums">' + escapeHtml(r.valueText) + '</div>' +
              '<div class="text-[11px] text-slate-500 mt-0.5">' + escapeHtml(r.formula) + '</div>' +
            '</div>' +
            '<div class="mt-3.5">' +
              '<div class="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden">' +
                '<div class="h-full ratio-bar-fill rounded-full ' + r.status.bar + '" style="width:' + r.pct.toFixed(1) + '%"></div>' +
              '</div>' +
              '<div class="mt-1.5 text-[11px] text-slate-500 font-medium tabular-nums">' + escapeHtml(r.target) + '</div>' +
            '</div>' +
          '</div>'
        );
      })
      .join('');
  }

  function renderAssetsTable(summary) {
    const tbody = document.getElementById('assets-table-body');
    const tfoot = document.getElementById('assets-table-foot');
    if (!tbody) return;

    const state = myFinance.Storage.getState();
    const assets = state.assets || [];
    const totalAssets = summary ? summary.totalAssets : 0;

    const filtered = assets.filter(function (a) {
      if (assetCategoryFilter === 'ALL') return true;
      if (assetCategoryFilter === 'PRODUCTIVE') return a.productive === true;
      return a.category === assetCategoryFilter;
    });

    if (filtered.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="10" class="py-10 text-center text-slate-400 text-sm">No assets match the selected filter. Use the entry bar above to add an asset.</td></tr>';
      if (tfoot) tfoot.innerHTML = '';
      return;
    }

    let sumBalance = 0;
    let sumProdBalance = 0;
    let sumCashReturn = 0;
    let sumCapGain = 0;
    let sumTotalReturn = 0;

    tbody.innerHTML = filtered
      .map(function (a) {
        const amt = Number(a.amount) || 0;
        const rates = getAssetRates(a);
        const annualCashReturn = a.productive ? (amt * rates.cashReturnRate) / 100 : 0;
        const annualCapGain = a.productive ? (amt * rates.capitalGrowthRate) / 100 : 0;
        const annualTotalReturn = annualCashReturn + annualCapGain;
        const sharePct = totalAssets > 0 ? ((amt / totalAssets) * 100).toFixed(1) + '%' : '0.0%';

        sumBalance += amt;
        if (a.productive) {
          sumProdBalance += amt;
          sumCashReturn += annualCashReturn;
          sumCapGain += annualCapGain;
          sumTotalReturn += annualTotalReturn;
        }

        const catBadge =
          a.category === 'Liquid'
            ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200/80"><span class="w-1.5 h-1.5 rounded-full bg-sky-500"></span>Liquid</span>'
            : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/80"><span class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>Fixed</span>';

        const cashRateBadge = a.productive
          ? '<span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 tabular-nums">' +
              rates.cashReturnRate.toFixed(2) + '%/yr' +
            '</span>'
          : '<span class="text-xs text-slate-400 tabular-nums">0.00%</span>';

        const capRateBadge = a.productive
          ? '<span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200/80 tabular-nums">' +
              rates.capitalGrowthRate.toFixed(2) + '%/yr' +
            '</span>'
          : '<span class="text-xs text-slate-400 tabular-nums">0.00%</span>';

        const totalRateBadge = a.productive
          ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200/80 tabular-nums">' +
              '✓ ' + rates.totalReturnRate.toFixed(2) + '%/yr' +
            '</span>'
          : '<span class="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-500">Non-Productive</span>';

        const cashReturnCell = a.productive
          ? '<span class="font-semibold text-emerald-600 tabular-nums">+' + formatMoney(annualCashReturn) + '/yr</span>'
          : '<span class="text-slate-400">—</span>';

        const capGainCell = a.productive
          ? '<span class="font-semibold text-purple-600 tabular-nums">+' + formatMoney(annualCapGain) + '/yr</span>'
          : '<span class="text-slate-400">—</span>';

        const totalReturnCell = a.productive
          ? '<span class="font-bold text-slate-900 tabular-nums">+' + formatMoney(annualTotalReturn) + '/yr</span>'
          : '<span class="text-slate-400">—</span>';

        return (
          '<tr class="border-b border-slate-100 hover:bg-indigo-50/30 transition-colors group">' +
            '<td class="py-3 px-2.5 text-sm">' +
              '<div class="font-semibold text-slate-900">' + escapeHtml(a.name) + '</div>' +
              '<div class="text-[11px] text-slate-400 tabular-nums">' + sharePct + ' of total assets</div>' +
            '</td>' +
            '<td class="py-3 px-2.5 text-sm whitespace-nowrap">' + catBadge + '</td>' +
            '<td class="py-3 px-2.5 text-sm font-semibold text-right text-slate-900 tabular-nums whitespace-nowrap">' + formatMoney(amt) + '</td>' +
            '<td class="py-3 px-2.5 text-sm text-right whitespace-nowrap">' + cashRateBadge + '</td>' +
            '<td class="py-3 px-2.5 text-sm text-right whitespace-nowrap">' + capRateBadge + '</td>' +
            '<td class="py-3 px-2.5 text-sm text-right whitespace-nowrap">' + totalRateBadge + '</td>' +
            '<td class="py-3 px-2.5 text-sm text-right whitespace-nowrap">' + cashReturnCell + '</td>' +
            '<td class="py-3 px-2.5 text-sm text-right whitespace-nowrap">' + capGainCell + '</td>' +
            '<td class="py-3 px-2.5 text-sm text-right whitespace-nowrap">' + totalReturnCell + '</td>' +
            '<td class="py-3 px-2.5 text-right whitespace-nowrap">' +
              '<button type="button" data-action="edit-asset" data-id="' + escapeHtml(a.id) + '" class="text-xs font-medium text-indigo-600 hover:text-indigo-800 mr-1 px-2 py-1 rounded-md hover:bg-indigo-50 transition-colors">Edit</button>' +
              '<button type="button" data-action="delete-asset" data-id="' + escapeHtml(a.id) + '" class="text-xs font-medium text-rose-600 hover:text-rose-800 px-2 py-1 rounded-md hover:bg-rose-50 transition-colors">Delete</button>' +
            '</td>' +
          '</tr>'
        );
      })
      .join('');

    if (tfoot) {
      const avgCashRate = sumProdBalance > 0 ? (sumCashReturn / sumProdBalance) * 100 : 0;
      const avgCapRate = sumProdBalance > 0 ? (sumCapGain / sumProdBalance) * 100 : 0;
      const avgTotalRate = avgCashRate + avgCapRate;

      tfoot.innerHTML =
        '<tr class="bg-slate-50/95 border-t-2 border-slate-200 text-xs font-semibold text-slate-800">' +
          '<td class="py-2.5 px-2.5" colspan="2">Total / Weighted Avg (' + filtered.length + ' asset' + (filtered.length === 1 ? '' : 's') + ')</td>' +
          '<td class="py-2.5 px-2.5 text-right tabular-nums whitespace-nowrap">' + formatMoney(sumBalance) + '</td>' +
          '<td class="py-2.5 px-2.5 text-right text-emerald-700 tabular-nums whitespace-nowrap">' + avgCashRate.toFixed(2) + '%/yr</td>' +
          '<td class="py-2.5 px-2.5 text-right text-purple-700 tabular-nums whitespace-nowrap">' + avgCapRate.toFixed(2) + '%/yr</td>' +
          '<td class="py-2.5 px-2.5 text-right font-bold text-indigo-800 tabular-nums whitespace-nowrap">' + avgTotalRate.toFixed(2) + '%/yr</td>' +
          '<td class="py-2.5 px-2.5 text-right text-emerald-700 tabular-nums whitespace-nowrap">+' + formatMoney(sumCashReturn) + '/yr</td>' +
          '<td class="py-2.5 px-2.5 text-right text-purple-700 tabular-nums whitespace-nowrap">+' + formatMoney(sumCapGain) + '/yr</td>' +
          '<td class="py-2.5 px-2.5 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">+' + formatMoney(sumTotalReturn) + '/yr</td>' +
          '<td class="py-2.5 px-2.5"></td>' +
        '</tr>';
    }
  }

  function renderLiabilitiesTable(summary) {
    const tbody = document.getElementById('liabilities-table-body');
    if (!tbody) return;

    const state = myFinance.Storage.getState();
    const liabilities = state.liabilities || [];
    const totalLiab = summary ? summary.totalLiabilities : 0;

    const filtered = liabilities.filter(function (l) {
      if (liabilityCategoryFilter === 'ALL') return true;
      return l.category === liabilityCategoryFilter;
    });

    if (filtered.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="py-10 text-center text-slate-400 text-sm">No liabilities match the selected filter. Use the entry bar above to add a liability.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered
      .map(function (l) {
        const sharePct = totalLiab > 0 ? ((l.amount / totalLiab) * 100).toFixed(1) + '%' : '0.0%';
        const catBadge =
          l.category === 'Short-Term'
            ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200/80"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>Short-Term</span>'
            : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-rose-50 text-rose-800 border border-rose-200/80"><span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>Long-Term</span>';

        return (
          '<tr class="border-b border-slate-100 hover:bg-rose-50/25 transition-colors group">' +
            '<td class="py-3 px-3 text-sm">' +
              '<div class="font-semibold text-slate-900">' + escapeHtml(l.name) + '</div>' +
              '<div class="text-[11px] text-slate-400 tabular-nums">' + sharePct + ' of total debt</div>' +
            '</td>' +
            '<td class="py-3 px-3 text-sm">' + catBadge + '</td>' +
            '<td class="py-3 px-3 text-sm font-semibold text-right text-rose-600 tabular-nums">' + formatMoney(l.amount) + '</td>' +
            '<td class="py-3 px-3 text-sm text-right text-slate-600 tabular-nums">' +
              (l.interestRate ? Number(l.interestRate).toFixed(2) + '% APR' : '0.00%') +
            '</td>' +
            '<td class="py-3 px-3 text-right whitespace-nowrap">' +
              '<button type="button" data-action="edit-liability" data-id="' + escapeHtml(l.id) + '" class="text-xs font-medium text-indigo-600 hover:text-indigo-800 mr-1.5 px-2 py-1 rounded-md hover:bg-indigo-50 transition-colors">Edit</button>' +
              '<button type="button" data-action="delete-liability" data-id="' + escapeHtml(l.id) + '" class="text-xs font-medium text-rose-600 hover:text-rose-800 px-2 py-1 rounded-md hover:bg-rose-50 transition-colors">Delete</button>' +
            '</td>' +
          '</tr>'
        );
      })
      .join('');
  }

  function updateAssetTotalReturnInput() {
    const prodInput = document.getElementById('asset-productive-input');
    const cashInput = document.getElementById('asset-cash-return-input');
    const capInput = document.getElementById('asset-capital-growth-input');
    const totalInput = document.getElementById('asset-return-input');
    const formulaBadge = document.getElementById('asset-total-return-formula');

    const isProd = prodInput ? prodInput.checked : true;
    const cashRate = isProd && cashInput ? parseFloat(cashInput.value) || 0 : 0;
    const capRate = isProd && capInput ? parseFloat(capInput.value) || 0 : 0;
    const totalRate = cashRate + capRate;

    if (totalInput) {
      totalInput.value = totalRate.toFixed(2);
    }
    if (formulaBadge) {
      formulaBadge.textContent = isProd
        ? cashRate.toFixed(2) + '% Cash + ' + capRate.toFixed(2) + '% Growth = ' + totalRate.toFixed(2) + '% Total'
        : 'Non-Productive (0.00% Total)';
    }
  }

  function refreshAll() {
    const state = myFinance.Storage.getState();
    const summary = computeSummary();
    renderSummaryCards(summary);
    renderRatios(summary);
    renderAssetsTable(summary);
    renderLiabilitiesTable(summary);
    updateAssetTotalReturnInput();
    if (myFinance.Charts && myFinance.Charts.renderBalanceSheetCharts) {
      myFinance.Charts.renderBalanceSheetCharts(summary, state.assets || []);
    }
  }

  function resetAssetForm() {
    editingAssetId = null;
    const nameInput = document.getElementById('asset-name-input');
    const catInput = document.getElementById('asset-category-input');
    const amtInput = document.getElementById('asset-amount-input');
    const prodInput = document.getElementById('asset-productive-input');
    const cashInput = document.getElementById('asset-cash-return-input');
    const capInput = document.getElementById('asset-capital-growth-input');
    const submitBtn = document.getElementById('asset-submit-btn');
    const cancelBtn = document.getElementById('asset-cancel-btn');

    if (nameInput) nameInput.value = '';
    if (catInput) catInput.value = 'Liquid';
    if (amtInput) amtInput.value = '';
    if (prodInput) prodInput.checked = true;
    if (cashInput) {
      cashInput.value = '2.5';
      cashInput.disabled = false;
    }
    if (capInput) {
      capInput.value = '3.0';
      capInput.disabled = false;
    }
    updateAssetTotalReturnInput();
    if (submitBtn) submitBtn.textContent = '+ Add Asset';
    if (cancelBtn) cancelBtn.classList.add('hidden');
  }

  function resetLiabilityForm() {
    editingLiabilityId = null;
    const nameInput = document.getElementById('liability-name-input');
    const catInput = document.getElementById('liability-category-input');
    const amtInput = document.getElementById('liability-amount-input');
    const rateInput = document.getElementById('liability-rate-input');
    const submitBtn = document.getElementById('liability-submit-btn');
    const cancelBtn = document.getElementById('liability-cancel-btn');

    if (nameInput) nameInput.value = '';
    if (catInput) catInput.value = 'Short-Term';
    if (amtInput) amtInput.value = '';
    if (rateInput) rateInput.value = '0.0';
    if (submitBtn) submitBtn.textContent = '+ Add Liability';
    if (cancelBtn) cancelBtn.classList.add('hidden');
  }

  function bindEvents() {
    const prodCheckbox = document.getElementById('asset-productive-input');
    const cashInput = document.getElementById('asset-cash-return-input');
    const capInput = document.getElementById('asset-capital-growth-input');

    if (prodCheckbox && !prodCheckbox.dataset.boundV13) {
      prodCheckbox.dataset.boundV13 = '1';
      prodCheckbox.addEventListener('change', function () {
        const isProd = prodCheckbox.checked;
        if (cashInput) {
          cashInput.disabled = !isProd;
          if (!isProd) cashInput.value = '0.0';
          else if ((parseFloat(cashInput.value) || 0) === 0 && (parseFloat(capInput && capInput.value) || 0) === 0) {
            cashInput.value = '2.5';
          }
        }
        if (capInput) {
          capInput.disabled = !isProd;
          if (!isProd) capInput.value = '0.0';
          else if ((parseFloat(capInput.value) || 0) === 0 && (parseFloat(cashInput && cashInput.value) || 0) === 2.5) {
            capInput.value = '3.0';
          }
        }
        updateAssetTotalReturnInput();
      });
    }

    if (cashInput && !cashInput.dataset.boundV13) {
      cashInput.dataset.boundV13 = '1';
      cashInput.addEventListener('input', updateAssetTotalReturnInput);
      cashInput.addEventListener('change', updateAssetTotalReturnInput);
    }
    if (capInput && !capInput.dataset.boundV13) {
      capInput.dataset.boundV13 = '1';
      capInput.addEventListener('input', updateAssetTotalReturnInput);
      capInput.addEventListener('change', updateAssetTotalReturnInput);
    }

    const assetForm = document.getElementById('asset-entry-form');
    if (assetForm && !assetForm.dataset.boundV13) {
      assetForm.dataset.boundV13 = '1';
      assetForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const name = (document.getElementById('asset-name-input').value || '').trim();
        const category = document.getElementById('asset-category-input').value;
        const amount = parseFloat(document.getElementById('asset-amount-input').value);
        const productive = document.getElementById('asset-productive-input').checked;
        const cashReturnRate = productive
          ? parseFloat(document.getElementById('asset-cash-return-input').value) || 0
          : 0;
        const capitalGrowthRate = productive
          ? parseFloat(document.getElementById('asset-capital-growth-input').value) || 0
          : 0;
        const totalReturnRate = Number((cashReturnRate + capitalGrowthRate).toFixed(4));

        if (!name || !Number.isFinite(amount) || amount < 0) {
          myFinance.Logger.warn('BalanceSheet', 'Rejected invalid asset entry.', {
            name,
            amount
          });
          if (myFinance.App && myFinance.App.showToast) {
            myFinance.App.showToast('Please enter a valid asset name and non-negative amount.', 'warn');
          }
          return;
        }

        const state = myFinance.Storage.getState();
        if (editingAssetId) {
          const idx = state.assets.findIndex((a) => a.id === editingAssetId);
          if (idx !== -1) {
            state.assets[idx] = {
              id: editingAssetId,
              name,
              category,
              amount,
              productive,
              cashReturnRate,
              capitalGrowthRate,
              totalReturnRate,
              returnRate: totalReturnRate
            };
            myFinance.Logger.info('BalanceSheet', 'Updated asset: ' + name, state.assets[idx]);
          }
        } else {
          const newAsset = {
            id: 'ast_' + Date.now(),
            name,
            category,
            amount,
            productive,
            cashReturnRate,
            capitalGrowthRate,
            totalReturnRate,
            returnRate: totalReturnRate
          };
          state.assets.push(newAsset);
          myFinance.Logger.info('BalanceSheet', 'Added new asset: ' + name, newAsset);
        }

        myFinance.Storage.save();
        resetAssetForm();
        refreshAll();
      });
    }

    const assetCancelBtn = document.getElementById('asset-cancel-btn');
    if (assetCancelBtn && !assetCancelBtn.dataset.boundV13) {
      assetCancelBtn.dataset.boundV13 = '1';
      assetCancelBtn.addEventListener('click', resetAssetForm);
    }

    const liabilityForm = document.getElementById('liability-entry-form');
    if (liabilityForm && !liabilityForm.dataset.boundV13) {
      liabilityForm.dataset.boundV13 = '1';
      liabilityForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const name = (document.getElementById('liability-name-input').value || '').trim();
        const category = document.getElementById('liability-category-input').value;
        const amount = parseFloat(document.getElementById('liability-amount-input').value);
        const interestRate = parseFloat(document.getElementById('liability-rate-input').value) || 0;

        if (!name || !Number.isFinite(amount) || amount < 0) {
          myFinance.Logger.warn('BalanceSheet', 'Rejected invalid liability entry.', {
            name,
            amount
          });
          if (myFinance.App && myFinance.App.showToast) {
            myFinance.App.showToast('Please enter a valid liability name and non-negative amount.', 'warn');
          }
          return;
        }

        const state = myFinance.Storage.getState();
        if (editingLiabilityId) {
          const idx = state.liabilities.findIndex((l) => l.id === editingLiabilityId);
          if (idx !== -1) {
            state.liabilities[idx] = {
              id: editingLiabilityId,
              name,
              category,
              amount,
              interestRate
            };
            myFinance.Logger.info('BalanceSheet', 'Updated liability: ' + name, state.liabilities[idx]);
          }
        } else {
          const newLiab = {
            id: 'lib_' + Date.now(),
            name,
            category,
            amount,
            interestRate
          };
          state.liabilities.push(newLiab);
          myFinance.Logger.info('BalanceSheet', 'Added new liability: ' + name, newLiab);
        }

        myFinance.Storage.save();
        resetLiabilityForm();
        refreshAll();
      });
    }

    const liabCancelBtn = document.getElementById('liability-cancel-btn');
    if (liabCancelBtn && !liabCancelBtn.dataset.boundV13) {
      liabCancelBtn.dataset.boundV13 = '1';
      liabCancelBtn.addEventListener('click', resetLiabilityForm);
    }

    const assetFilterSelect = document.getElementById('asset-filter-select');
    if (assetFilterSelect && !assetFilterSelect.dataset.boundV13) {
      assetFilterSelect.dataset.boundV13 = '1';
      assetFilterSelect.addEventListener('change', function (e) {
        assetCategoryFilter = e.target.value;
        renderAssetsTable(computeSummary());
      });
    }

    const liabFilterSelect = document.getElementById('liability-filter-select');
    if (liabFilterSelect && !liabFilterSelect.dataset.boundV13) {
      liabFilterSelect.dataset.boundV13 = '1';
      liabFilterSelect.addEventListener('change', function (e) {
        liabilityCategoryFilter = e.target.value;
        renderLiabilitiesTable(computeSummary());
      });
    }

    const assetsTbody = document.getElementById('assets-table-body');
    if (assetsTbody && !assetsTbody.dataset.boundV13) {
      assetsTbody.dataset.boundV13 = '1';
      assetsTbody.addEventListener('click', function (e) {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');
        const state = myFinance.Storage.getState();

        if (action === 'delete-asset') {
          const target = state.assets.find((a) => a.id === id);
          state.assets = state.assets.filter((a) => a.id !== id);
          myFinance.Storage.save();
          myFinance.Logger.info('BalanceSheet', 'Deleted asset: ' + (target ? target.name : id));
          refreshAll();
        } else if (action === 'edit-asset') {
          const target = state.assets.find((a) => a.id === id);
          if (!target) return;
          editingAssetId = target.id;
          const rates = getAssetRates(target);
          document.getElementById('asset-name-input').value = target.name;
          document.getElementById('asset-category-input').value = target.category;
          document.getElementById('asset-amount-input').value = target.amount;
          document.getElementById('asset-productive-input').checked = target.productive;

          const cInput = document.getElementById('asset-cash-return-input');
          const gInput = document.getElementById('asset-capital-growth-input');
          if (cInput) {
            cInput.disabled = !target.productive;
            cInput.value = rates.cashReturnRate;
          }
          if (gInput) {
            gInput.disabled = !target.productive;
            gInput.value = rates.capitalGrowthRate;
          }
          updateAssetTotalReturnInput();
          document.getElementById('asset-submit-btn').textContent = 'Save Asset Changes';
          document.getElementById('asset-cancel-btn').classList.remove('hidden');
        }
      });
    }

    const liabTbody = document.getElementById('liabilities-table-body');
    if (liabTbody && !liabTbody.dataset.boundV13) {
      liabTbody.dataset.boundV13 = '1';
      liabTbody.addEventListener('click', function (e) {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');
        const state = myFinance.Storage.getState();

        if (action === 'delete-liability') {
          const target = state.liabilities.find((l) => l.id === id);
          state.liabilities = state.liabilities.filter((l) => l.id !== id);
          myFinance.Storage.save();
          myFinance.Logger.info('BalanceSheet', 'Deleted liability: ' + (target ? target.name : id));
          refreshAll();
        } else if (action === 'edit-liability') {
          const target = state.liabilities.find((l) => l.id === id);
          if (!target) return;
          editingLiabilityId = target.id;
          document.getElementById('liability-name-input').value = target.name;
          document.getElementById('liability-category-input').value = target.category;
          document.getElementById('liability-amount-input').value = target.amount;
          document.getElementById('liability-rate-input').value = target.interestRate || 0;
          document.getElementById('liability-submit-btn').textContent = 'Save Liability Changes';
          document.getElementById('liability-cancel-btn').classList.remove('hidden');
        }
      });
    }
  }

  myFinance.BalanceSheet = {
    _version: '1.3.0',
    init: function () {
      bindEvents();
      refreshAll();
      myFinance.Logger.info('BalanceSheet', 'Balance Sheet module v1.3.0 initialized.');
    },
    computeSummary: computeSummary,
    refresh: refreshAll
  };
})(window);
