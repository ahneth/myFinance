/**
 * ============================================================================
 * myFinance - Local Storage & Excel (.xlsx) Backup/Restore Module (storage.js)
 * Persists user data locally on device via localStorage and exports/imports
 * multi-sheet Excel (.xlsx) files using SheetJS.
 * ============================================================================
 */
(function (global) {
  'use strict';

  const myFinance = (global.myFinance = global.myFinance || {});
  const STORAGE_KEY = 'myFinance_app_state_v1';

  function getDefaultState() {
    return {
      meta: {
        appName: 'myFinance',
        version: '1.1.0',
        lastUpdated: new Date().toISOString()
      },
      assets: [
        {
          id: 'ast_1',
          name: 'High-Yield Savings Account',
          category: 'Liquid',
          amount: 45000,
          productive: true,
          returnRate: 4.2
        },
        {
          id: 'ast_2',
          name: 'Checking & Emergency Cash',
          category: 'Liquid',
          amount: 15000,
          productive: false,
          returnRate: 0.0
        },
        {
          id: 'ast_3',
          name: 'Global Equity Index ETF Portfolio',
          category: 'Liquid',
          amount: 185000,
          productive: true,
          returnRate: 8.0
        },
        {
          id: 'ast_4',
          name: 'Short-Term Treasury Bills',
          category: 'Liquid',
          amount: 35000,
          productive: true,
          returnRate: 4.8
        },
        {
          id: 'ast_5',
          name: 'Primary Residence Property',
          category: 'Fixed',
          amount: 620000,
          productive: false,
          returnRate: 0.0
        },
        {
          id: 'ast_6',
          name: 'Retirement Pension / MPF / 401(k)',
          category: 'Fixed',
          amount: 210000,
          productive: true,
          returnRate: 6.5
        },
        {
          id: 'ast_7',
          name: 'Rental Investment Apartment',
          category: 'Fixed',
          amount: 340000,
          productive: true,
          returnRate: 5.4
        }
      ],
      liabilities: [
        {
          id: 'lib_1',
          name: 'Credit Card Statement Balance',
          category: 'Short-Term',
          amount: 4200,
          interestRate: 19.9
        },
        {
          id: 'lib_2',
          name: 'Annual Tax & Insurance Provision',
          category: 'Short-Term',
          amount: 9800,
          interestRate: 0.0
        },
        {
          id: 'lib_3',
          name: 'Primary Residence Mortgage',
          category: 'Long-Term',
          amount: 365000,
          interestRate: 3.75
        },
        {
          id: 'lib_4',
          name: 'Rental Property Mortgage',
          category: 'Long-Term',
          amount: 175000,
          interestRate: 4.1
        }
      ],
      cashflowParams: {
        currentAge: 35,
        initialSavings: 265000,
        startingSavings: 265000,
        yearlyIncome: 125000,
        incomeGrowthRate: 4.0,
        investmentPercentage: 28.0,
        cashReturnRate: 2.5,
        capitalGrowthRate: 6.0,
        inflationRate: 2.5,
        retirementAge: 60,
        expectedPension: 250000,
        retirementSpendingPV: 58000,
        lifeExpectancy: 90
      }
    };
  }

  let appState = getDefaultState();

  function sanitizeAsset(raw, idx) {
    const category =
      String(raw.category || raw.Category || 'Liquid').trim().toLowerCase() === 'fixed'
        ? 'Fixed'
        : 'Liquid';
    const prodRaw = raw.productive !== undefined ? raw.productive : raw.Productive;
    const productive =
      prodRaw === true ||
      String(prodRaw).toLowerCase() === 'true' ||
      String(prodRaw).toLowerCase() === 'yes' ||
      String(prodRaw) === '1';
    const amount = Math.max(0, parseFloat(raw.amount !== undefined ? raw.amount : raw.Amount) || 0);
    const rate = parseFloat(
      raw.returnRate !== undefined
        ? raw.returnRate
        : raw['Yearly Return Rate (%)'] !== undefined
        ? raw['Yearly Return Rate (%)']
        : 0
    ) || 0;

    return {
      id: String(raw.id || raw.ID || 'ast_' + Date.now() + '_' + idx),
      name: String(raw.name || raw.Name || 'Unnamed Asset').trim(),
      category: category,
      amount: amount,
      productive: productive,
      returnRate: productive ? rate : rate
    };
  }

  function sanitizeLiability(raw, idx) {
    const catStr = String(raw.category || raw.Category || 'Short-Term').trim().toLowerCase();
    const category = catStr.includes('long') ? 'Long-Term' : 'Short-Term';
    const amount = Math.max(0, parseFloat(raw.amount !== undefined ? raw.amount : raw.Amount) || 0);
    const interestRate = Math.max(
      0,
      parseFloat(
        raw.interestRate !== undefined
          ? raw.interestRate
          : raw['Interest Rate (%)'] !== undefined
          ? raw['Interest Rate (%)']
          : 0
      ) || 0
    );

    return {
      id: String(raw.id || raw.ID || 'lib_' + Date.now() + '_' + idx),
      name: String(raw.name || raw.Name || 'Unnamed Liability').trim(),
      category: category,
      amount: amount,
      interestRate: interestRate
    };
  }

  function sanitizeCashflowParams(raw) {
    const def = getDefaultState().cashflowParams;
    if (!raw || typeof raw !== 'object') return def;

    const num = (val, fallback) => {
      const parsed = parseFloat(val);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    const currentAge = Math.max(18, Math.min(99, Math.round(num(raw.currentAge, def.currentAge))));
    const retirementAge = Math.max(
      currentAge + 1,
      Math.min(105, Math.round(num(raw.retirementAge, def.retirementAge)))
    );
    const lifeExpectancy = Math.max(
      retirementAge + 1,
      Math.min(120, Math.round(num(raw.lifeExpectancy, def.lifeExpectancy)))
    );

    const initSav = Math.max(
      0,
      num(
        raw.initialSavings !== undefined ? raw.initialSavings : raw.startingSavings,
        def.initialSavings
      )
    );

    return {
      currentAge: currentAge,
      initialSavings: initSav,
      startingSavings: initSav,
      yearlyIncome: Math.max(0, num(raw.yearlyIncome, def.yearlyIncome)),
      incomeGrowthRate: num(raw.incomeGrowthRate, def.incomeGrowthRate),
      investmentPercentage: Math.max(0, Math.min(100, num(raw.investmentPercentage, def.investmentPercentage))),
      cashReturnRate: num(raw.cashReturnRate, def.cashReturnRate),
      capitalGrowthRate: num(raw.capitalGrowthRate, def.capitalGrowthRate),
      inflationRate: num(raw.inflationRate, def.inflationRate),
      retirementAge: retirementAge,
      expectedPension: Math.max(0, num(raw.expectedPension, def.expectedPension)),
      retirementSpendingPV: Math.max(0, num(raw.retirementSpendingPV, def.retirementSpendingPV)),
      lifeExpectancy: lifeExpectancy
    };
  }

  function loadFromLocalStorage() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        myFinance.Logger.info('Storage', 'No existing local data found; initialized with default starter portfolio.');
        saveToLocalStorage();
        return appState;
      }
      const parsed = JSON.parse(raw);
      appState = {
        meta: {
          appName: 'myFinance',
          version: '1.1.0',
          lastUpdated: (parsed.meta && parsed.meta.lastUpdated) || new Date().toISOString()
        },
        assets: Array.isArray(parsed.assets) ? parsed.assets.map(sanitizeAsset) : getDefaultState().assets,
        liabilities: Array.isArray(parsed.liabilities)
          ? parsed.liabilities.map(sanitizeLiability)
          : getDefaultState().liabilities,
        cashflowParams: sanitizeCashflowParams(parsed.cashflowParams)
      };
      myFinance.Logger.info('Storage', 'Loaded state from device localStorage.', {
        assetsCount: appState.assets.length,
        liabilitiesCount: appState.liabilities.length,
        lastUpdated: appState.meta.lastUpdated
      });
    } catch (err) {
      myFinance.Logger.error('Storage', 'Failed reading from localStorage; using in-memory defaults.', {
        error: err.message
      });
      appState = getDefaultState();
    }
    return appState;
  }

  function saveToLocalStorage() {
    appState.meta.lastUpdated = new Date().toISOString();
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
      const statusEl = document.getElementById('storage-status-text');
      if (statusEl) {
        const d = new Date(appState.meta.lastUpdated);
        statusEl.textContent = 'Saved locally at ' + d.toLocaleTimeString();
      }
      myFinance.Logger.debug('Storage', 'State persisted to device localStorage.', {
        assets: appState.assets.length,
        liabilities: appState.liabilities.length
      });
      return true;
    } catch (err) {
      myFinance.Logger.error('Storage', 'Unable to save to localStorage.', {
        error: err.message
      });
      return false;
    }
  }

  function exportToExcel() {
    try {
      if (typeof global.XLSX === 'undefined') {
        throw new Error('SheetJS (XLSX) library is not loaded.');
      }

      const wb = global.XLSX.utils.book_new();

      // 1. Assets Sheet
      const assetsRows = appState.assets.map(function (a) {
        const annualReturn = a.productive ? (a.amount * a.returnRate) / 100 : 0;
        return {
          ID: a.id,
          Name: a.name,
          Category: a.category,
          Amount: a.amount,
          Productive: a.productive ? 'Yes' : 'No',
          'Yearly Return Rate (%)': a.returnRate,
          'Est. Annual Return ($)': Number(annualReturn.toFixed(2))
        };
      });
      const wsAssets = global.XLSX.utils.json_to_sheet(assetsRows);
      global.XLSX.utils.book_append_sheet(wb, wsAssets, 'Assets');

      // 2. Liabilities Sheet
      const liabRows = appState.liabilities.map(function (l) {
        return {
          ID: l.id,
          Name: l.name,
          Category: l.category,
          Amount: l.amount,
          'Interest Rate (%)': l.interestRate || 0
        };
      });
      const wsLiabilities = global.XLSX.utils.json_to_sheet(liabRows);
      global.XLSX.utils.book_append_sheet(wb, wsLiabilities, 'Liabilities');

      // 3. Cashflow_Params Sheet
      const p = appState.cashflowParams;
      const paramRows = [
        { Key: 'currentAge', Parameter: 'Current Age', Value: p.currentAge, Unit: 'Years' },
        { Key: 'initialSavings', Parameter: 'Initial Savings', Value: p.initialSavings, Unit: 'Currency ($)' },
        { Key: 'yearlyIncome', Parameter: 'Yearly Income', Value: p.yearlyIncome, Unit: 'Currency ($)' },
        { Key: 'incomeGrowthRate', Parameter: 'Expected Income Growth Rate', Value: p.incomeGrowthRate, Unit: '% per year' },
        { Key: 'investmentPercentage', Parameter: 'Investment Percentage', Value: p.investmentPercentage, Unit: '% of income' },
        { Key: 'cashReturnRate', Parameter: 'Yearly Cash Return Rate', Value: p.cashReturnRate, Unit: '% per year' },
        { Key: 'capitalGrowthRate', Parameter: 'Yearly Capital Growth Rate', Value: p.capitalGrowthRate, Unit: '% per year' },
        { Key: 'inflationRate', Parameter: 'Expected Inflation Rate', Value: p.inflationRate, Unit: '% per year' },
        { Key: 'retirementAge', Parameter: 'Target Retirement Age', Value: p.retirementAge, Unit: 'Years' },
        { Key: 'expectedPension', Parameter: 'Expected Pension (Lump Sum)', Value: p.expectedPension, Unit: 'Currency ($ Lump Sum at Retirement)' },
        { Key: 'retirementSpendingPV', Parameter: 'Yearly Spending in Retirement (Present Value)', Value: p.retirementSpendingPV, Unit: 'Currency ($)' },
        { Key: 'lifeExpectancy', Parameter: 'Life Expectancy (Age of Decease)', Value: p.lifeExpectancy, Unit: 'Years' }
      ];
      const wsParams = global.XLSX.utils.json_to_sheet(paramRows);
      global.XLSX.utils.book_append_sheet(wb, wsParams, 'Cashflow_Params');

      // 4. Balance_Sheet_Summary Sheet
      if (myFinance.BalanceSheet && myFinance.BalanceSheet.computeSummary) {
        const bs = myFinance.BalanceSheet.computeSummary();
        const summaryRows = [
          { Metric: 'Total Liquid Assets', Value: bs.liquidAssets },
          { Metric: 'Total Fixed Assets', Value: bs.fixedAssets },
          { Metric: 'Total Assets', Value: bs.totalAssets },
          { Metric: 'Productive Assets', Value: bs.productiveAssets },
          { Metric: 'Expected Yearly Return from Productive Assets ($)', Value: Number(bs.totalAnnualReturn.toFixed(2)) },
          { Metric: 'Short-Term Liabilities', Value: bs.shortTermLiabilities },
          { Metric: 'Long-Term Liabilities', Value: bs.longTermLiabilities },
          { Metric: 'Total Liabilities', Value: bs.totalLiabilities },
          { Metric: 'Net Worth', Value: bs.netWorth },
          { Metric: 'Liquidity Ratio (Liquid / Short-Term Debt)', Value: Number(bs.liquidityRatio.toFixed(2)) },
          { Metric: 'Debt-to-Asset Ratio (%)', Value: Number(bs.debtToAssetRatio.toFixed(2)) },
          { Metric: 'Solvency Ratio (%)', Value: Number(bs.solvencyRatio.toFixed(2)) },
          { Metric: 'Productive Asset Ratio (%)', Value: Number(bs.productiveAssetRatio.toFixed(2)) }
        ];
        const wsSummary = global.XLSX.utils.json_to_sheet(summaryRows);
        global.XLSX.utils.book_append_sheet(wb, wsSummary, 'Balance_Sheet_Summary');
      }

      // 5. Cashflow_Forecast Sheet
      if (myFinance.Cashflow && myFinance.Cashflow.computeForecast) {
        const forecast = myFinance.Cashflow.computeForecast();
        const forecastRows = forecast.rows.map(function (r) {
          return {
            Year: r.year,
            Age: r.age,
            Phase: r.phase,
            'Beginning Savings ($)': Number(r.beginSavings.toFixed(2)),
            'Yearly Income ($)': Number(r.income.toFixed(2)),
            'Expected Pension Lump Sum ($)': Number(r.pension.toFixed(2)),
            'Spending Outflow ($)': Number(r.spending.toFixed(2)),
            'Net Cash Inflow / Outflow ($)': Number(r.netInflowOutflow.toFixed(2)),
            'Remaining Savings After Cashflows ($)': Number(r.remainingSavings.toFixed(2)),
            'Cash Return ($)': Number(r.cashReturn.toFixed(2)),
            'Capital Growth ($)': Number(r.capitalGrowth.toFixed(2)),
            'Ending Savings Nominal ($)': Number(r.endSavings.toFixed(2)),
            'Ending Savings Present Value ($)': Number(r.endSavingsPV.toFixed(2))
          };
        });
        const wsForecast = global.XLSX.utils.json_to_sheet(forecastRows);
        global.XLSX.utils.book_append_sheet(wb, wsForecast, 'Cashflow_Forecast');
      }

      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const stamp =
        now.getFullYear() +
        pad(now.getMonth() + 1) +
        pad(now.getDate()) +
        '_' +
        pad(now.getHours()) +
        pad(now.getMinutes());
      const fileName = 'myFinance_Backup_' + stamp + '.xlsx';

      global.XLSX.writeFile(wb, fileName);

      myFinance.Logger.info('Storage', 'Exported portfolio & forecast data to Excel workbook.', {
        fileName: fileName,
        sheets: ['Assets', 'Liabilities', 'Cashflow_Params', 'Balance_Sheet_Summary', 'Cashflow_Forecast']
      });
      if (myFinance.App && myFinance.App.showToast) {
        myFinance.App.showToast('Exported backup to ' + fileName, 'success');
      }
    } catch (err) {
      myFinance.Logger.error('Storage', 'Excel export failed: ' + err.message, {
        stack: err.stack || null
      });
      if (myFinance.App && myFinance.App.showToast) {
        myFinance.App.showToast('Excel export failed: ' + err.message, 'error');
      }
    }
  }

  function importFromExcelFile(file, onComplete) {
    if (!file) return;
    try {
      if (typeof global.XLSX === 'undefined') {
        throw new Error('SheetJS (XLSX) library is not loaded.');
      }

      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = global.XLSX.read(data, { type: 'array' });

          const sheetNames = workbook.SheetNames || [];
          myFinance.Logger.info('Storage', 'Parsing uploaded Excel file: ' + file.name, {
            sheetsFound: sheetNames
          });

          let importedAssets = null;
          let importedLiabilities = null;
          let importedParams = null;

          if (sheetNames.includes('Assets')) {
            const rawAssets = global.XLSX.utils.sheet_to_json(workbook.Sheets['Assets']);
            importedAssets = rawAssets.map(sanitizeAsset);
          }

          if (sheetNames.includes('Liabilities')) {
            const rawLiab = global.XLSX.utils.sheet_to_json(workbook.Sheets['Liabilities']);
            importedLiabilities = rawLiab.map(sanitizeLiability);
          }

          if (sheetNames.includes('Cashflow_Params')) {
            const rawParams = global.XLSX.utils.sheet_to_json(workbook.Sheets['Cashflow_Params']);
            const paramMap = Object.assign({}, appState.cashflowParams);
            rawParams.forEach(function (row) {
              const key = row.Key || row.key;
              const val = row.Value !== undefined ? row.Value : row.value;
              if (key && val !== undefined) {
                paramMap[key] = parseFloat(val);
              }
            });
            importedParams = sanitizeCashflowParams(paramMap);
          }

          if (!importedAssets && !importedLiabilities && !importedParams) {
            throw new Error(
              'Workbook must contain at least one valid sheet: "Assets", "Liabilities", or "Cashflow_Params".'
            );
          }

          if (importedAssets) appState.assets = importedAssets;
          if (importedLiabilities) appState.liabilities = importedLiabilities;
          if (importedParams) appState.cashflowParams = importedParams;

          saveToLocalStorage();

          myFinance.Logger.info('Storage', 'Successfully restored data from Excel file.', {
            fileName: file.name,
            assetsRestored: appState.assets.length,
            liabilitiesRestored: appState.liabilities.length
          });

          if (typeof onComplete === 'function') {
            onComplete(true);
          }
          if (myFinance.App && myFinance.App.showToast) {
            myFinance.App.showToast('Restored data from ' + file.name, 'success');
          }
        } catch (parseErr) {
          myFinance.Logger.error('Storage', 'Failed to parse Excel backup file: ' + parseErr.message, {
            fileName: file.name
          });
          if (myFinance.App && myFinance.App.showToast) {
            myFinance.App.showToast('Import error: ' + parseErr.message, 'error');
          }
          if (typeof onComplete === 'function') {
            onComplete(false);
          }
        }
      };

      reader.onerror = function () {
        myFinance.Logger.error('Storage', 'FileReader error while reading ' + file.name);
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      myFinance.Logger.error('Storage', 'Excel import failed: ' + err.message);
      if (myFinance.App && myFinance.App.showToast) {
        myFinance.App.showToast('Import failed: ' + err.message, 'error');
      }
    }
  }

  myFinance.Storage = {
    init: function () {
      return loadFromLocalStorage();
    },
    getState: function () {
      return appState;
    },
    save: saveToLocalStorage,
    resetToDefault: function () {
      appState = getDefaultState();
      saveToLocalStorage();
      myFinance.Logger.warn('Storage', 'Application state reset to default sample dataset.');
      return appState;
    },
    clearAll: function () {
      appState.assets = [];
      appState.liabilities = [];
      appState.cashflowParams.initialSavings = 0;
      appState.cashflowParams.startingSavings = 0;
      saveToLocalStorage();
      myFinance.Logger.warn('Storage', 'All assets and liabilities cleared by user.');
      return appState;
    },
    exportToExcel: exportToExcel,
    importFromExcelFile: importFromExcelFile
  };
})(window);
