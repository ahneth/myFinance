/**
 * ============================================================================
 * myFinance - Run-Time Logger & Error Diagnostics Module (logger.js)
 * Captures run-time events, state mutations, calculations, and uncaught errors
 * for live inspection and debugging in the bottom Run-Time Log section.
 * ============================================================================
 */
(function (global) {
  'use strict';

  const myFinance = (global.myFinance = global.myFinance || {});

  const MAX_LOGS = 500;
  const logs = [];
  let currentFilterLevel = 'ALL';
  let currentSearchQuery = '';
  let logIdCounter = 1;

  function formatTimestamp(date) {
    const pad = (n, w = 2) => String(n).padStart(w, '0');
    return (
      date.getFullYear() + '-' +
      pad(date.getMonth() + 1) + '-' +
      pad(date.getDate()) + ' ' +
      pad(date.getHours()) + ':' +
      pad(date.getMinutes()) + ':' +
      pad(date.getSeconds()) + '.' +
      pad(date.getMilliseconds(), 3)
    );
  }

  function addEntry(level, moduleName, message, details) {
    const now = new Date();
    const entry = {
      id: logIdCounter++,
      timestamp: formatTimestamp(now),
      iso: now.toISOString(),
      level: String(level || 'INFO').toUpperCase(),
      module: String(moduleName || 'System'),
      message: String(message || ''),
      details: details !== undefined ? details : null
    };

    logs.unshift(entry);
    if (logs.length > MAX_LOGS) {
      logs.pop();
    }

    renderLogs();
    updateCounts();
    return entry;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getBadgeClasses(level) {
    switch (level) {
      case 'ERROR':
        return 'bg-rose-500/20 text-rose-300 border border-rose-500/40';
      case 'WARN':
        return 'bg-amber-500/20 text-amber-300 border border-amber-500/40';
      case 'DEBUG':
        return 'bg-purple-500/20 text-purple-300 border border-purple-500/40';
      case 'INFO':
      default:
        return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
    }
  }

  function updateCounts() {
    const totalEl = document.getElementById('log-count-total');
    const infoEl = document.getElementById('log-count-info');
    const warnEl = document.getElementById('log-count-warn');
    const errorEl = document.getElementById('log-count-error');
    const headerErrorBadge = document.getElementById('header-error-badge');

    const counts = { TOTAL: logs.length, INFO: 0, WARN: 0, ERROR: 0, DEBUG: 0 };
    for (let i = 0; i < logs.length; i++) {
      const lvl = logs[i].level;
      if (counts[lvl] !== undefined) counts[lvl]++;
    }

    if (totalEl) totalEl.textContent = String(counts.TOTAL);
    if (infoEl) infoEl.textContent = String(counts.INFO + counts.DEBUG);
    if (warnEl) warnEl.textContent = String(counts.WARN);
    if (errorEl) errorEl.textContent = String(counts.ERROR);

    if (headerErrorBadge) {
      if (counts.ERROR > 0) {
        headerErrorBadge.textContent = counts.ERROR + ' Error' + (counts.ERROR > 1 ? 's' : '');
        headerErrorBadge.classList.remove('hidden');
      } else {
        headerErrorBadge.classList.add('hidden');
      }
    }
  }

  function getFilteredLogs() {
    return logs.filter(function (item) {
      const matchesLevel =
        currentFilterLevel === 'ALL' || item.level === currentFilterLevel;
      if (!matchesLevel) return false;
      if (!currentSearchQuery) return true;
      const q = currentSearchQuery.toLowerCase();
      const detailsStr = item.details ? JSON.stringify(item.details).toLowerCase() : '';
      return (
        item.message.toLowerCase().includes(q) ||
        item.module.toLowerCase().includes(q) ||
        item.level.toLowerCase().includes(q) ||
        detailsStr.includes(q)
      );
    });
  }

  function renderLogs() {
    const container = document.getElementById('log-entries-container');
    if (!container) return;

    const filtered = getFilteredLogs();
    if (filtered.length === 0) {
      container.innerHTML =
        '<div class="py-8 text-center text-slate-400 text-xs font-mono">No run-time log entries match the current filter.</div>';
      return;
    }

    const htmlParts = [];
    for (let i = 0; i < filtered.length; i++) {
      const item = filtered[i];
      let detailsHtml = '';
      if (item.details !== null && item.details !== undefined) {
        let serialized = '';
        try {
          serialized =
            typeof item.details === 'string'
              ? item.details
              : JSON.stringify(item.details, null, 2);
        } catch (e) {
          serialized = String(item.details);
        }
        detailsHtml =
          '<pre class="mt-1.5 p-2 rounded bg-slate-950/90 text-slate-300 text-[11px] overflow-x-auto border border-slate-800">' +
          escapeHtml(serialized) +
          '</pre>';
      }

      htmlParts.push(
        '<div class="py-2 px-3 border-b border-slate-800/80 hover:bg-slate-800/40 transition-colors font-mono text-xs">' +
          '<div class="flex flex-wrap items-center gap-2">' +
            '<span class="text-slate-400 text-[11px] shrink-0">[' + escapeHtml(item.timestamp) + ']</span>' +
            '<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ' + getBadgeClasses(item.level) + '">' +
              escapeHtml(item.level) +
            '</span>' +
            '<span class="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-medium shrink-0">' +
              escapeHtml(item.module) +
            '</span>' +
            '<span class="text-slate-100 break-all">' + escapeHtml(item.message) + '</span>' +
          '</div>' +
          detailsHtml +
        '</div>'
      );
    }

    container.innerHTML = htmlParts.join('');
  }

  function attachGlobalErrorHandlers() {
    global.addEventListener('error', function (event) {
      addEntry('ERROR', 'RuntimeException', event.message || 'Uncaught script error', {
        filename: event.filename || 'inline',
        lineno: event.lineno || 0,
        colno: event.colno || 0,
        stack: event.error && event.error.stack ? event.error.stack : null
      });
    });

    global.addEventListener('unhandledrejection', function (event) {
      const reason = event.reason;
      addEntry(
        'ERROR',
        'PromiseRejection',
        reason && reason.message ? reason.message : 'Unhandled Promise Rejection',
        {
          reason: reason ? String(reason) : 'Unknown',
          stack: reason && reason.stack ? reason.stack : null
        }
      );
    });
  }

  function bindLogControls() {
    const levelSelect = document.getElementById('log-filter-level');
    if (levelSelect) {
      levelSelect.addEventListener('change', function (e) {
        currentFilterLevel = e.target.value;
        renderLogs();
      });
    }

    const searchInput = document.getElementById('log-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function (e) {
        currentSearchQuery = e.target.value.trim();
        renderLogs();
      });
    }

    const clearBtn = document.getElementById('btn-clear-logs');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        logs.length = 0;
        addEntry('INFO', 'Logger', 'Run-time logs cleared by user.');
      });
    }

    const testWarnBtn = document.getElementById('btn-simulate-error');
    if (testWarnBtn) {
      testWarnBtn.addEventListener('click', function () {
        try {
          throw new Error('Simulated diagnostic runtime exception for debugging verification');
        } catch (err) {
          addEntry('ERROR', 'Diagnostics', err.message, {
            simulated: true,
            stack: err.stack || 'N/A',
            userAgent: navigator.userAgent
          });
          if (myFinance.App && myFinance.App.showToast) {
            myFinance.App.showToast('Simulated runtime error logged to diagnostics panel.', 'warn');
          }
        }
      });
    }

    const exportLogsBtn = document.getElementById('btn-export-logs');
    if (exportLogsBtn) {
      exportLogsBtn.addEventListener('click', function () {
        try {
          const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'myFinance_runtime_logs_' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.json';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          addEntry('INFO', 'Logger', 'Exported run-time logs to JSON file (' + logs.length + ' entries).');
        } catch (err) {
          addEntry('ERROR', 'Logger', 'Failed to export logs: ' + err.message);
        }
      });
    }
  }

  myFinance.Logger = {
    init: function () {
      attachGlobalErrorHandlers();
      bindLogControls();
      addEntry('INFO', 'Logger', 'Run-Time Logger & Error Trap initialized.', {
        timestamp: new Date().toISOString(),
        maxBuffer: MAX_LOGS
      });
    },
    info: function (mod, msg, details) {
      return addEntry('INFO', mod, msg, details);
    },
    warn: function (mod, msg, details) {
      return addEntry('WARN', mod, msg, details);
    },
    error: function (mod, msg, details) {
      return addEntry('ERROR', mod, msg, details);
    },
    debug: function (mod, msg, details) {
      return addEntry('DEBUG', mod, msg, details);
    },
    getLogs: function () {
      return logs.slice();
    },
    render: renderLogs
  };
})(window);
