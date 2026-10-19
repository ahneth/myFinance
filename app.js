/**
 * ============================================================================
 * myFinance - Main Application Controller (app.js)
 * Coordinates navigation tabs, Excel Backup/Restore triggers, Demo Reset modal,
 * Toast feedback, and module lifecycle initialization.
 * ============================================================================
 */
(function (global) {
  'use strict';

  const myFinance = (global.myFinance = global.myFinance || {});

  let activeTab = 'balance-sheet';

  function switchTab(tabId) {
    activeTab = tabId;
    const bsPanel = document.getElementById('panel-balance-sheet');
    const cfPanel = document.getElementById('panel-cashflow');
    const btnBs = document.getElementById('tab-btn-balance-sheet');
    const btnCf = document.getElementById('tab-btn-cashflow');

    if (tabId === 'balance-sheet') {
      if (bsPanel) bsPanel.classList.remove('hidden');
      if (cfPanel) cfPanel.classList.add('hidden');
      if (btnBs) btnBs.classList.add('active');
      if (btnCf) btnCf.classList.remove('active');
      if (myFinance.BalanceSheet) myFinance.BalanceSheet.refresh();
    } else if (tabId === 'cashflow') {
      if (bsPanel) bsPanel.classList.add('hidden');
      if (cfPanel) cfPanel.classList.remove('hidden');
      if (btnBs) btnBs.classList.remove('active');
      if (btnCf) btnCf.classList.add('active');
      if (myFinance.Cashflow) myFinance.Cashflow.refresh(false);
    }

    myFinance.Logger.info('App', 'Switched active view tab to: ' + tabId);
  }

  function showToast(message, type) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const colors =
      type === 'error'
        ? 'bg-rose-600 text-white border-rose-700'
        : type === 'warn'
        ? 'bg-amber-500 text-slate-950 border-amber-600'
        : 'bg-slate-900 text-white border-slate-700';

    const toast = document.createElement('div');
    toast.className =
      'toast-enter px-4 py-2.5 rounded-xl shadow-lg border text-xs sm:text-sm font-medium flex items-center gap-2 ' +
      colors;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(function () {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 3600);
  }

  function bindGlobalControls() {
    const btnBs = document.getElementById('tab-btn-balance-sheet');
    const btnCf = document.getElementById('tab-btn-cashflow');
    const btnJumpLogs = document.getElementById('btn-jump-logs');

    if (btnBs) {
      btnBs.addEventListener('click', function () {
        switchTab('balance-sheet');
      });
    }
    if (btnCf) {
      btnCf.addEventListener('click', function () {
        switchTab('cashflow');
      });
    }
    if (btnJumpLogs) {
      btnJumpLogs.addEventListener('click', function () {
        const logSec = document.getElementById('runtime-log-section');
        if (logSec) {
          logSec.scrollIntoView({ behavior: 'smooth' });
          myFinance.Logger.debug('App', 'Scrolled to Run-Time Log section.');
        }
      });
    }

    // Excel Backup (Export)
    const exportBtn = document.getElementById('btn-export-excel');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        myFinance.Storage.exportToExcel();
      });
    }

    // Excel Restore (Import)
    const importBtn = document.getElementById('btn-import-excel');
    const fileInput = document.getElementById('excel-file-input');
    if (importBtn && fileInput) {
      importBtn.addEventListener('click', function () {
        fileInput.value = '';
        fileInput.click();
      });
      fileInput.addEventListener('change', function (e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        myFinance.Storage.importFromExcelFile(file, function (success) {
          if (success) {
            if (myFinance.BalanceSheet) myFinance.BalanceSheet.refresh();
            if (myFinance.Cashflow) {
              myFinance.Cashflow.populateInputs();
              myFinance.Cashflow.refresh(false);
            }
          }
        });
      });
    }

    // Reset Demo Data Modal Controls
    const openResetModalBtn = document.getElementById('btn-open-reset-modal');
    const resetModal = document.getElementById('reset-confirm-modal');
    const cancelResetBtn = document.getElementById('btn-cancel-reset');
    const confirmResetDemoBtn = document.getElementById('btn-confirm-reset-demo');
    const confirmClearAllBtn = document.getElementById('btn-confirm-clear-all');

    if (openResetModalBtn && resetModal) {
      openResetModalBtn.addEventListener('click', function () {
        resetModal.classList.remove('hidden');
      });
    }
    if (cancelResetBtn && resetModal) {
      cancelResetBtn.addEventListener('click', function () {
        resetModal.classList.add('hidden');
      });
    }
    if (confirmResetDemoBtn && resetModal) {
      confirmResetDemoBtn.addEventListener('click', function () {
        myFinance.Storage.resetToDefault();
        if (myFinance.BalanceSheet) myFinance.BalanceSheet.refresh();
        if (myFinance.Cashflow) {
          myFinance.Cashflow.populateInputs();
          myFinance.Cashflow.refresh(false);
        }
        resetModal.classList.add('hidden');
        showToast('Restored default demo portfolio data.', 'success');
      });
    }
    if (confirmClearAllBtn && resetModal) {
      confirmClearAllBtn.addEventListener('click', function () {
        myFinance.Storage.clearAll();
        if (myFinance.BalanceSheet) myFinance.BalanceSheet.refresh();
        if (myFinance.Cashflow) {
          myFinance.Cashflow.populateInputs();
          myFinance.Cashflow.refresh(false);
        }
        resetModal.classList.add('hidden');
        showToast('Cleared all assets and liabilities.', 'warn');
      });
    }
  }

  function bootstrap() {
    try {
      if (myFinance.Logger) myFinance.Logger.init();
      if (myFinance.Storage) myFinance.Storage.init();
      if (myFinance.BalanceSheet) myFinance.BalanceSheet.init();
      if (myFinance.Cashflow) myFinance.Cashflow.init();
      bindGlobalControls();
      myFinance.Logger.info('App', 'PWA shortcut & bookmark icons configured (Android Web App Manifest, Apple Touch Icon, PC SVG/ICO favicons).');
      myFinance.Logger.info('App', 'myFinance web application ready.', {
        activeTab: activeTab
      });
    } catch (err) {
      if (myFinance.Logger) {
        myFinance.Logger.error('App', 'Fatal initialization error: ' + err.message, {
          stack: err.stack || null
        });
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

  myFinance.App = {
    switchTab: switchTab,
    showToast: showToast
  };
})(window);
