/**
 * ============================================================================
 * myFinance - Chart.js Visualization Module (charts.js)
 * Renders and updates interactive financial health charts on the Balance Sheet
 * and Yearly Cashflows & Forecast tabs with executive fintech styling.
 * ============================================================================
 */
(function (global) {
  'use strict';

  const myFinance = (global.myFinance = global.myFinance || {});

  const instances = {
    assetAllocation: null,
    balanceStructure: null,
    productiveYield: null,
    wealthTrajectory: null,
    cashflowComponents: null,
    incomeVsSpending: null
  };

  const TOOLTIP_STYLE = {
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    titleColor: '#f8fafc',
    bodyColor: '#e2e8f0',
    borderColor: 'rgba(148, 163, 184, 0.2)',
    borderWidth: 1,
    padding: 11,
    cornerRadius: 10,
    titleFont: { family: 'Inter, sans-serif', size: 12, weight: '600' },
    bodyFont: { family: 'JetBrains Mono, monospace', size: 11 }
  };

  function formatCompactCurrency(val) {
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (abs >= 1e6) return sign + '$' + (abs / 1e6).toFixed(2) + 'M';
    if (abs >= 1e3) return sign + '$' + (abs / 1e3).toFixed(0) + 'k';
    return sign + '$' + abs.toFixed(0);
  }

  function renderBalanceSheetCharts(summary, assets) {
    if (typeof global.Chart === 'undefined') {
      myFinance.Logger.warn('Charts', 'Chart.js is not loaded; skipping Balance Sheet charts.');
      return;
    }

    try {
      // 1. Asset Allocation & Productivity Doughnut Chart
      const ctxAlloc = document.getElementById('chart-asset-allocation');
      if (ctxAlloc) {
        let liqProd = 0,
          liqNonProd = 0,
          fixProd = 0,
          fixNonProd = 0;

        assets.forEach(function (a) {
          if (a.category === 'Liquid') {
            if (a.productive) liqProd += a.amount;
            else liqNonProd += a.amount;
          } else {
            if (a.productive) fixProd += a.amount;
            else fixNonProd += a.amount;
          }
        });

        const dataValues = [liqProd, liqNonProd, fixProd, fixNonProd];
        const total = dataValues.reduce((s, v) => s + v, 0);

        if (instances.assetAllocation) {
          instances.assetAllocation.destroy();
        }

        instances.assetAllocation = new global.Chart(ctxAlloc, {
          type: 'doughnut',
          data: {
            labels: [
              'Liquid • Productive',
              'Liquid • Non-Productive',
              'Fixed • Productive',
              'Fixed • Non-Productive'
            ],
            datasets: [
              {
                data: total > 0 ? dataValues : [1],
                backgroundColor:
                  total > 0
                    ? ['#10b981', '#38bdf8', '#4f46e5', '#94a3b8']
                    : ['#e2e8f0'],
                borderWidth: 3,
                borderColor: '#ffffff',
                hoverOffset: 6
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '68%',
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  usePointStyle: true,
                  pointStyle: 'circle',
                  boxWidth: 8,
                  padding: 14,
                  font: { family: 'Inter, sans-serif', size: 11, weight: '500' },
                  color: '#475569'
                }
              },
              tooltip: Object.assign({}, TOOLTIP_STYLE, {
                callbacks: {
                  label: function (ctx) {
                    if (total === 0) return 'No assets entered';
                    const val = ctx.parsed || 0;
                    const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
                    return ' ' + ctx.label + ': $' + val.toLocaleString() + ' (' + pct + '%)';
                  }
                }
              })
            }
          }
        });
      }

      // 2. Balance Sheet Structure Bar Chart
      const ctxStruct = document.getElementById('chart-balance-structure');
      if (ctxStruct) {
        if (instances.balanceStructure) {
          instances.balanceStructure.destroy();
        }

        instances.balanceStructure = new global.Chart(ctxStruct, {
          type: 'bar',
          data: {
            labels: ['Liquid Assets', 'Fixed Assets', 'Short-Term Debt', 'Long-Term Debt', 'Net Worth'],
            datasets: [
              {
                label: 'Amount ($)',
                data: [
                  summary.liquidAssets,
                  summary.fixedAssets,
                  summary.shortTermLiabilities,
                  summary.longTermLiabilities,
                  summary.netWorth
                ],
                backgroundColor: [
                  '#0ea5e9',
                  '#4f46e5',
                  '#fb7185',
                  '#e11d48',
                  summary.netWorth >= 0 ? '#10b981' : '#f43f5e'
                ],
                borderRadius: 8,
                maxBarThickness: 44
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: Object.assign({}, TOOLTIP_STYLE, {
                callbacks: {
                  label: function (ctx) {
                    return ' $' + Number(ctx.parsed.y || 0).toLocaleString();
                  }
                }
              })
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  callback: function (value) {
                    return formatCompactCurrency(value);
                  },
                  font: { family: 'JetBrains Mono, monospace', size: 10 },
                  color: '#64748b'
                },
                grid: { color: '#f1f5f9' },
                border: { display: false }
              },
              x: {
                ticks: {
                  font: { family: 'Inter, sans-serif', size: 11, weight: '500' },
                  color: '#475569'
                },
                grid: { display: false },
                border: { display: false }
              }
            }
          }
        });
      }

      // 3. Productive Assets Annual Return Chart
      const ctxYield = document.getElementById('chart-productive-yield');
      if (ctxYield) {
        if (instances.productiveYield) {
          instances.productiveYield.destroy();
        }

        const prodAssets = assets
          .filter((a) => a.productive && a.amount > 0)
          .map((a) => ({
            name: a.name.length > 22 ? a.name.slice(0, 20) + '…' : a.name,
            annualReturn: (a.amount * a.returnRate) / 100,
            rate: a.returnRate
          }))
          .sort((a, b) => b.annualReturn - a.annualReturn);

        instances.productiveYield = new global.Chart(ctxYield, {
          type: 'bar',
          data: {
            labels: prodAssets.length ? prodAssets.map((p) => p.name) : ['No Productive Assets'],
            datasets: [
              {
                label: 'Expected Annual Return ($)',
                data: prodAssets.length ? prodAssets.map((p) => p.annualReturn) : [0],
                backgroundColor: '#10b981',
                borderRadius: 6,
                maxBarThickness: 26
              }
            ]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: Object.assign({}, TOOLTIP_STYLE, {
                callbacks: {
                  label: function (ctx) {
                    const item = prodAssets[ctx.dataIndex];
                    if (!item) return ' $0';
                    return (
                      ' $' +
                      Math.round(item.annualReturn).toLocaleString() +
                      '/yr (' +
                      item.rate.toFixed(2) +
                      '% yield)'
                    );
                  }
                }
              })
            },
            scales: {
              x: {
                beginAtZero: true,
                ticks: {
                  callback: function (val) {
                    return formatCompactCurrency(val);
                  },
                  font: { family: 'JetBrains Mono, monospace', size: 10 },
                  color: '#64748b'
                },
                grid: { color: '#f1f5f9' },
                border: { display: false }
              },
              y: {
                ticks: {
                  font: { family: 'Inter, sans-serif', size: 11, weight: '500' },
                  color: '#334155'
                },
                grid: { display: false },
                border: { display: false }
              }
            }
          }
        });
      }
    } catch (err) {
      myFinance.Logger.error('Charts', 'Error rendering Balance Sheet charts: ' + err.message);
    }
  }

  function renderCashflowCharts(forecast) {
    if (typeof global.Chart === 'undefined') {
      myFinance.Logger.warn('Charts', 'Chart.js is not loaded; skipping Cashflow charts.');
      return;
    }

    try {
      const rows = forecast.rows || [];
      const labels = rows.map((r) => 'Age ' + r.age + ' (' + r.year + ')');

      // 1. Accumulated Savings Forecast (Nominal vs Present Value)
      const ctxWealth = document.getElementById('chart-wealth-trajectory');
      if (ctxWealth) {
        if (instances.wealthTrajectory) {
          instances.wealthTrajectory.destroy();
        }

        instances.wealthTrajectory = new global.Chart(ctxWealth, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [
              {
                label: 'Ending Savings (Nominal $)',
                data: rows.map((r) => Math.round(r.endSavings)),
                borderColor: '#4f46e5',
                backgroundColor: 'rgba(79, 70, 229, 0.12)',
                borderWidth: 2.5,
                fill: true,
                tension: 0.3,
                pointRadius: 1.5,
                pointHoverRadius: 5
              },
              {
                label: 'Remaining Savings Pre-Return ($)',
                data: rows.map((r) => Math.round(r.remainingSavings)),
                borderColor: '#6366f1',
                backgroundColor: 'transparent',
                borderWidth: 1.5,
                borderDash: [2, 2],
                fill: false,
                tension: 0.3,
                pointRadius: 0
              },
              {
                label: 'Ending Savings (Inflation-Adjusted PV $)',
                data: rows.map((r) => Math.round(r.endSavingsPV)),
                borderColor: '#0d9488',
                backgroundColor: 'rgba(13, 148, 136, 0.08)',
                borderWidth: 2,
                borderDash: [5, 4],
                fill: true,
                tension: 0.3,
                pointRadius: 1.5,
                pointHoverRadius: 5
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: {
                position: 'top',
                labels: {
                  usePointStyle: true,
                  pointStyle: 'circle',
                  boxWidth: 8,
                  font: { family: 'Inter, sans-serif', size: 11, weight: '500' },
                  color: '#475569'
                }
              },
              tooltip: Object.assign({}, TOOLTIP_STYLE, {
                callbacks: {
                  label: function (ctx) {
                    return ' ' + ctx.dataset.label + ': $' + Number(ctx.parsed.y || 0).toLocaleString();
                  }
                }
              })
            },
            scales: {
              y: {
                ticks: {
                  callback: function (value) {
                    return formatCompactCurrency(value);
                  },
                  font: { family: 'JetBrains Mono, monospace', size: 10 },
                  color: '#64748b'
                },
                grid: { color: '#f1f5f9' },
                border: { display: false }
              },
              x: {
                ticks: {
                  maxTicksLimit: 10,
                  font: { family: 'Inter, sans-serif', size: 10 },
                  color: '#64748b'
                },
                grid: { display: false },
                border: { display: false }
              }
            }
          }
        });
      }

      // 2. Yearly Cashflows Breakdown
      const ctxComp = document.getElementById('chart-cashflow-components');
      if (ctxComp) {
        if (instances.cashflowComponents) {
          instances.cashflowComponents.destroy();
        }

        instances.cashflowComponents = new global.Chart(ctxComp, {
          type: 'bar',
          data: {
            labels: rows.map((r) => 'Age ' + r.age),
            datasets: [
              {
                label: 'Invested Salary ($)',
                data: rows.map((r) => Math.round(r.activeSavings)),
                backgroundColor: '#3b82f6',
                stack: 'cashflows',
                borderRadius: 2
              },
              {
                label: 'Expected Pension Lump Sum ($)',
                data: rows.map((r) => Math.round(r.pension)),
                backgroundColor: '#0ea5e9',
                stack: 'cashflows',
                borderRadius: 2
              },
              {
                label: 'Cash Return Yield ($)',
                data: rows.map((r) => Math.round(r.cashReturn)),
                backgroundColor: '#10b981',
                stack: 'cashflows',
                borderRadius: 2
              },
              {
                label: 'Capital Growth ($)',
                data: rows.map((r) => Math.round(r.capitalGrowth)),
                backgroundColor: '#8b5cf6',
                stack: 'cashflows',
                borderRadius: 2
              },
              {
                label: 'Retirement Spending Outflow ($)',
                data: rows.map((r) => (r.isRetired ? -Math.round(r.spending) : 0)),
                backgroundColor: '#f43f5e',
                stack: 'cashflows',
                borderRadius: 2
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: {
                position: 'top',
                labels: {
                  usePointStyle: true,
                  pointStyle: 'circle',
                  boxWidth: 8,
                  font: { family: 'Inter, sans-serif', size: 10, weight: '500' },
                  color: '#475569'
                }
              },
              tooltip: Object.assign({}, TOOLTIP_STYLE, {
                callbacks: {
                  label: function (ctx) {
                    const v = Number(ctx.parsed.y || 0);
                    return ' ' + ctx.dataset.label + ': $' + v.toLocaleString();
                  }
                }
              })
            },
            scales: {
              x: {
                stacked: true,
                ticks: {
                  maxTicksLimit: 10,
                  font: { family: 'Inter, sans-serif', size: 10 },
                  color: '#64748b'
                },
                grid: { display: false },
                border: { display: false }
              },
              y: {
                stacked: true,
                ticks: {
                  callback: function (value) {
                    return formatCompactCurrency(value);
                  },
                  font: { family: 'JetBrains Mono, monospace', size: 10 },
                  color: '#64748b'
                },
                grid: { color: '#f1f5f9' },
                border: { display: false }
              }
            }
          }
        });
      }

      // 3. Yearly Inflows (Income + Pension), Portfolio Return & Spending Curve
      const ctxIncSpend = document.getElementById('chart-income-vs-spending');
      if (ctxIncSpend) {
        if (instances.incomeVsSpending) {
          instances.incomeVsSpending.destroy();
        }

        instances.incomeVsSpending = new global.Chart(ctxIncSpend, {
          type: 'line',
          data: {
            labels: rows.map((r) => 'Age ' + r.age),
            datasets: [
              {
                label: 'Active Income + Pension Lump Sum ($)',
                data: rows.map((r) => Math.round(r.income + r.pension)),
                borderColor: '#0284c7',
                backgroundColor: 'transparent',
                borderWidth: 2.2,
                tension: 0.25,
                pointRadius: 1.5
              },
              {
                label: 'Yearly Spending Outflow ($)',
                data: rows.map((r) => Math.round(r.spending)),
                borderColor: '#e11d48',
                backgroundColor: 'rgba(225, 29, 72, 0.08)',
                borderWidth: 2.2,
                fill: true,
                tension: 0.25,
                pointRadius: 1.5
              },
              {
                label: 'Cash Return + Capital Growth ($)',
                data: rows.map((r) => Math.round(r.cashReturn + r.capitalGrowth)),
                borderColor: '#10b981',
                backgroundColor: 'transparent',
                borderWidth: 2.2,
                borderDash: [4, 3],
                tension: 0.25,
                pointRadius: 1.5
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: {
                position: 'top',
                labels: {
                  usePointStyle: true,
                  pointStyle: 'circle',
                  boxWidth: 8,
                  font: { family: 'Inter, sans-serif', size: 11, weight: '500' },
                  color: '#475569'
                }
              },
              tooltip: Object.assign({}, TOOLTIP_STYLE, {
                callbacks: {
                  label: function (ctx) {
                    return ' ' + ctx.dataset.label + ': $' + Number(ctx.parsed.y || 0).toLocaleString();
                  }
                }
              })
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  callback: function (value) {
                    return formatCompactCurrency(value);
                  },
                  font: { family: 'JetBrains Mono, monospace', size: 10 },
                  color: '#64748b'
                },
                grid: { color: '#f1f5f9' },
                border: { display: false }
              },
              x: {
                ticks: {
                  maxTicksLimit: 10,
                  font: { family: 'Inter, sans-serif', size: 10 },
                  color: '#64748b'
                },
                grid: { display: false },
                border: { display: false }
              }
            }
          }
        });
      }
    } catch (err) {
      myFinance.Logger.error('Charts', 'Error rendering Cashflow charts: ' + err.message);
    }
  }

  myFinance.Charts = {
    renderBalanceSheetCharts: renderBalanceSheetCharts,
    renderCashflowCharts: renderCashflowCharts
  };
})(window);
