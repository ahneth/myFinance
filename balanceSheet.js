/**
 * ============================================================================
 * myFinance - Balance Sheet & Financial Ratios Module (balanceSheet.js)
 * Manages Assets (Liquid / Fixed, Productive flag & Yearly Return Rate),
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

  function computeSummary() {
    const state = myFinance.Storage.getState();
    const assets = state.assets || [];
    const liabilities = state.liabilities || [];

    let liquidAssets = 0;
    let fixedAssets = 0;
    let productiveAssets = 0;
    let nonProductiveAssets = 0;
    let totalAnnualReturn = 0;

    for (let i = 0; i < assets.length; i++) {
      const a = assets[i];
      const amt = Number(a.amount) || 0;
      const rate = Number(a.returnRate) || 0;

      if (a.category === 'Liquid') liquidAssets += amt;
      else fixedAssets += amt;

      if (a.productive) {
        productiveAssets += amt;
        totalAnnualReturn += (amt * rate) / 100;
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

    // Key Financial Ratios
    const liquidityRatio =
      shortTermLiabilities > 0
        ? liquidAssets / shortTermLiabilities
        : liquidAssets > 0
        ? 99.9
        : 0;

    const debtToAssetRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;
    const solvencyRatio = totalAssets > 0 ? (netWorth / totalAssets) * 100 : 0;
    const productiveAssetRatio = totalAssets > 0 ? (productiveAssets / totalAssets) * 100 : 0;
    const weightedProductiveYield =
      productiveAssets > 0 ? (totalAnnualReturn / productiveAssets) * 100 : 0;
    const effectiveTotalAssetYield =
      totalAssets > 0 ? (totalAnnualReturn / totalAssets) * 100 : 0;
    const liquidToTotalAssetRatio = totalAssets > 0 ? (liquidAssets / totalAssets) * 100 : 0;

    return {
      liquidAssets,
      fixedAssets,
      totalAssets,
      productiveAssets,
      nonProductiveAssets,
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
      weightedProductiveYield,
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

    if (prodEl) prodEl.textContent = formatMoney(summary.totalAnnualReturn) + '/yr';
    if (prodSubEl) {
      prodSubEl.textContent =
        formatMoney(summary.productiveAssets) +
        ' productive (' +
        summary.weightedProductiveYield.toFixed(2) +
        '% avg yield)';
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
            ? { label: 'High Yielding', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', bar: 'bg-indigo-600' }
            : summary.productiveAssetRatio >= 30
            ? { label: 'Balanced', cls: 'bg-amber-50 text-amber-700 border border-amber-200', bar: 'bg-indigo-500' }
            : { label: 'Low Productive Share', cls: 'bg-rose-50 text-rose-700 border border-rose-200', bar: 'bg-rose-500' },
        pct: Math.min(100, Math.max(0, summary.productiveAssetRatio)),
        target: 'Benchmark: ≥ 50.0% income-producing'
      },
      {
        name: 'Weighted Yield on Productive',
        formula: 'Est. Annual Return ÷ Productive Assets',
        valueText: summary.weightedProductiveYield.toFixed(2) + '%',
        status:
          summary.weightedProductiveYield >= 5.0
            ? { label: 'Strong Return', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', bar: 'bg-emerald-500' }
            : summary.weightedProductiveYield >= 2.5
            ? { label: 'Moderate Yield', cls: 'bg-sky-50 text-sky-700 border border-sky-200', bar: 'bg-sky-500' }
            : { label: 'Conservative', cls: 'bg-slate-100 text-slate-700 border border-slate-200', bar: 'bg-slate-400' },
        pct: Math.min(100, Math.max(5, (summary.weightedProductiveYield / 10) * 100)),
        target: 'Effective Total Asset Return: ' + summary.effectiveTotalAssetYield.toFixed(2) + '%'
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
                '<span class="px-2 py-0.5 text-[11px] font-semibold rounded-full shrink-0 ' + r.status.cls + '">' +
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
              '<div class="mt-1.5 text-[11px] text-slate-500 font-medium">' + escapeHtml(r.target) + '</div>' +
            '</div>' +
          '</div>'
        );
      })
      .join('');
  }

  function renderAssetsTable(summary) {
    const tbody = document.getElementById('assets-table-body');
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
        '<tr><td colspan="6" class="py-10 text-center text-slate-400 text-sm">No assets match the selected filter. Use the entry bar above to add an asset.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered
      .map(function (a) {
        const annualReturn = a.productive ? (a.amount * a.returnRate) / 100 : 0;
        const sharePct = totalAssets > 0 ? ((a.amount / totalAssets) * 100).toFixed(1) + '%' : '0.0%';

        const catBadge =
          a.category === 'Liquid'
            ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200/80"><span class="w-1.5 h-1.5 rounded-full bg-sky-500"></span>Liquid</span>'
            : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/80"><span class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>Fixed</span>';

        const prodBadge = a.productive
          ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">✓ ' +
            Number(a.returnRate).toFixed(2) +
            '% Yield</span>'
          : '<span class="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-500">Non-Productive</span>';

        return (
          '<tr class="border-b border-slate-100 hover:bg-indigo-50/30 transition-colors group">' +
            '<td class="py-3 px-3 text-sm">' +
              '<div class="font-semibold text-slate-900">' + escapeHtml(a.name) + '</div>' +
              '<div class="text-[11px] text-slate-400 tabular-nums">' + sharePct + ' of total assets</div>' +
            '</td>' +
            '<td class="py-3 px-3 text-sm">' + catBadge + '</td>' +
            '<td class="py-3 px-3 text-sm font-semibold text-right text-slate-900 tabular-nums">' + formatMoney(a.amount) + '</td>' +
            '<td class="py-3 px-3 text-sm text-center">' + prodBadge + '</td>' +
            '<td class="py-3 px-3 text-sm text-right font-semibold tabular-nums ' +
              (annualReturn > 0 ? 'text-emerald-600' : 'text-slate-400') +
            '">' +
              (a.productive ? '+' + formatMoney(annualReturn) + '/yr' : '—') +
            '</td>' +
            '<td class="py-3 px-3 text-right whitespace-nowrap">' +
              '<button type="button" data-action="edit-asset" data-id="' + escapeHtml(a.id) + '" class="text-xs font-medium text-indigo-600 hover:text-indigo-800 mr-1.5 px-2 py-1 rounded-md hover:bg-indigo-50 transition-colors">Edit</button>' +
              '<button type="button" data-action="delete-asset" data-id="' + escapeHtml(a.id) + '" class="text-xs font-medium text-rose-600 hover:text-rose-800 px-2 py-1 rounded-md hover:bg-rose-50 transition-colors">Delete</button>' +
            '</td>' +
          '</tr>'
        );
      })
      .join('');
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

  function refreshAll() {
    const state = myFinance.Storage.getState();
    const summary = computeSummary();
    renderSummaryCards(summary);
    renderRatios(summary);
    renderAssetsTable(summary);
    renderLiabilitiesTable(summary);
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
    const rateInput = document.getElementById('asset-return-input');
    const submitBtn = document.getElementById('asset-submit-btn');
    const cancelBtn = document.getElementById('asset-cancel-btn');

    if (nameInput) nameInput.value = '';
    if (catInput) catInput.value = 'Liquid';
    if (amtInput) amtInput.value = '';
    if (prodInput) prodInput.checked = true;
    if (rateInput) {
      rateInput.value = '5.0';
      rateInput.disabled = false;
    }
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
    const rateInput = document.getElementById('asset-return-input');
    if (prodCheckbox && rateInput) {
      prodCheckbox.addEventListener('change', function () {
        rateInput.disabled = !prodCheckbox.checked;
        if (!prodCheckbox.checked) {
          rateInput.value = '0.0';
        } else if (parseFloat(rateInput.value) === 0) {
          rateInput.value = '5.0';
        }
      });
    }

    const assetForm = document.getElementById('asset-entry-form');
    if (assetForm) {
      assetForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const name = (document.getElementById('asset-name-input').value || '').trim();
        const category = document.getElementById('asset-category-input').value;
        const amount = parseFloat(document.getElementById('asset-amount-input').value);
        const productive = document.getElementById('asset-productive-input').checked;
        const returnRate = productive
          ? parseFloat(document.getElementById('asset-return-input').value) || 0
          : 0;

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
              returnRate
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
            returnRate
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
    if (assetCancelBtn) {
      assetCancelBtn.addEventListener('click', resetAssetForm);
    }

    const liabilityForm = document.getElementById('liability-entry-form');
    if (liabilityForm) {
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
    if (liabCancelBtn) {
      liabCancelBtn.addEventListener('click', resetLiabilityForm);
    }

    const assetFilterSelect = document.getElementById('asset-filter-select');
    if (assetFilterSelect) {
      assetFilterSelect.addEventListener('change', function (e) {
        assetCategoryFilter = e.target.value;
        renderAssetsTable(computeSummary());
      });
    }

    const liabFilterSelect = document.getElementById('liability-filter-select');
    if (liabFilterSelect) {
      liabFilterSelect.addEventListener('change', function (e) {
        liabilityCategoryFilter = e.target.value;
        renderLiabilitiesTable(computeSummary());
      });
    }

    const assetsTbody = document.getElementById('assets-table-body');
    if (assetsTbody) {
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
          document.getElementById('asset-name-input').value = target.name;
          document.getElementById('asset-category-input').value = target.category;
          document.getElementById('asset-amount-input').value = target.amount;
          document.getElementById('asset-productive-input').checked = target.productive;
          const rInput = document.getElementById('asset-return-input');
          rInput.disabled = !target.productive;
          rInput.value = target.returnRate;
          document.getElementById('asset-submit-btn').textContent = 'Save Asset Changes';
          document.getElementById('asset-cancel-btn').classList.remove('hidden');
        }
      });
    }

    const liabTbody = document.getElementById('liabilities-table-body');
    if (liabTbody) {
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
    init: function () {
      bindEvents();
      refreshAll();
      myFinance.Logger.info('BalanceSheet', 'Balance Sheet module initialized.');
    },
    computeSummary: computeSummary,
    refresh: refreshAll
  };
})(window);
