/**
 * js/app.js — Expense & Budget Visualizer
 * All application logic in a single IIFE to avoid polluting global scope.
 */
(function () {
  'use strict';

  // ─────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────

  /** @type {import('./app').Transaction[]} */
  let transactions = [];

  /** @type {string[]} — built-ins + custom categories */
  let categories = [];

  /** @type {{ field: 'amount' | null, direction: 'asc' | 'desc' }} */
  let sortState = { field: null, direction: 'asc' };

  /** @type {string} — empty string means "All Categories" */
  let categoryFilter = '';

  /** @type {'list' | 'summary'} */
  let activeView = 'list';

  // ─────────────────────────────────────────────
  // Storage Module
  // ─────────────────────────────────────────────

  const STORAGE_KEY = 'expense_transactions';
  const CATEGORIES_KEY = 'expense_categories';

  const storage = {
    /**
     * Test whether localStorage is available.
     * @returns {boolean}
     */
    isAvailable() {
      try {
        const probe = '__expense_probe__';
        localStorage.setItem(probe, probe);
        localStorage.removeItem(probe);
        return true;
      } catch (_) {
        return false;
      }
    },

    /**
     * Load transactions from localStorage.
     * @returns {{ ok: true, data: object[] } | { ok: false, error: string }}
     */
    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === null) {
          return { ok: true, data: [] };
        }
        const data = JSON.parse(raw);
        return { ok: true, data: Array.isArray(data) ? data : [] };
      } catch (_) {
        return { ok: false, error: 'Saved transaction data could not be loaded and has been discarded.' };
      }
    },

    /**
     * Save transactions to localStorage.
     * @param {object[]} txList
     * @returns {{ ok: true } | { ok: false, error: string }}
     */
    save(txList) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(txList));
        return { ok: true };
      } catch (_) {
        return { ok: false, error: 'The change could not be saved persistently. Your data is safe for this session.' };
      }
    },

    /**
     * Load custom categories from localStorage.
     * @returns {{ ok: true, data: string[] } | { ok: false, error: string }}
     */
    loadCategories() {
      try {
        const raw = localStorage.getItem(CATEGORIES_KEY);
        if (raw === null) {
          return { ok: true, data: [] };
        }
        const data = JSON.parse(raw);
        return { ok: true, data: Array.isArray(data) ? data : [] };
      } catch (_) {
        return { ok: false, error: 'Saved category data could not be loaded.' };
      }
    },

    /**
     * Save custom categories to localStorage.
     * @param {string[]} cats
     * @returns {{ ok: true } | { ok: false, error: string }}
     */
    saveCategories(cats) {
      try {
        localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats));
        return { ok: true };
      } catch (_) {
        return { ok: false, error: 'Categories could not be saved persistently.' };
      }
    },
  };

  // ─────────────────────────────────────────────
  // Validator Module
  // ─────────────────────────────────────────────

  const validator = {
    /**
     * Validate a transaction input object.
     * @param {{ name: string, amount: any, category: string }} input
     * @returns {{ valid: true } | { valid: false, errors: { name?: string, amount?: string, category?: string } }}
     */
    validateTransaction({ name, amount, category }) {
      const errors = {};

      // Validate name: non-empty and ≤ 100 chars
      if (typeof name !== 'string' || name.trim().length === 0) {
        errors.name = 'Item name is required.';
      } else if (name.trim().length > 100) {
        errors.name = 'Item name must not exceed 100 characters.';
      }

      // Validate amount: must be a whole integer in [1, 999999999999]
      const numAmount = Number(amount);
      if (amount === '' || amount === null || amount === undefined || isNaN(numAmount)) {
        errors.amount = 'Amount is required.';
      } else if (numAmount !== Math.floor(numAmount)) {
        errors.amount = 'Amount must be a whole number (no decimals)';
      } else if (numAmount < 1 || numAmount > 999999999999) {
        errors.amount = 'Amount must be a whole number between 1 and 999,999,999,999.';
      }

      // Validate category: must be a non-empty string
      if (typeof category !== 'string' || category.trim().length === 0) {
        errors.category = 'Please select a category.';
      }

      if (Object.keys(errors).length > 0) {
        return { valid: false, errors };
      }
      return { valid: true };
    },

    /**
     * Validate a new custom category name.
     * @param {string} name
     * @param {string[]} existingCategories
     * @returns {{ valid: true } | { valid: false, error: string }}
     */
    validateCategory(name, existingCategories) {
      // Reject empty or whitespace-only strings
      if (typeof name !== 'string' || name.trim().length === 0) {
        return { valid: false, error: 'Category name must not be empty.' };
      }

      // Reject names exceeding 50 characters
      if (name.trim().length > 50) {
        return { valid: false, error: 'Category name must not exceed 50 characters.' };
      }

      // Reject case-insensitive duplicates
      const nameLower = name.trim().toLowerCase();
      const isDuplicate = existingCategories.some(function (cat) {
        return cat.toLowerCase() === nameLower;
      });
      if (isDuplicate) {
        return { valid: false, error: 'A category with this name already exists.' };
      }

      return { valid: true };
    },
  };

  // ─────────────────────────────────────────────
  // Category Manager Module
  // ─────────────────────────────────────────────

  const BUILTIN_CATEGORIES = ['Food', 'Transport', 'Fun'];
  const MAX_CUSTOM_CATEGORIES = 20;

  /** @type {string[]} — only the user-defined custom categories (built-ins are prepended at runtime) */
  let customCategories = [];

  const categoryManager = {
    /**
     * Initialise: load custom categories from storage and prepend built-ins.
     * On storage failure, initialises with an empty custom list.
     */
    init() {
      const result = storage.loadCategories();
      if (!result.ok) {
        customCategories = [];
      } else {
        customCategories = Array.isArray(result.data) ? result.data : [];
      }
      categories = [...BUILTIN_CATEGORIES, ...customCategories];
    },

    /**
     * Return the full list of categories (built-ins + custom).
     * @returns {string[]}
     */
    getAll() {
      return [...BUILTIN_CATEGORIES, ...customCategories];
    },

    /**
     * Add a new custom category.
     * Validates the name, enforces the 20-custom-category limit,
     * updates in-memory state, and persists to storage.
     * @param {string} name
     * @returns {{ ok: true } | { ok: false, error: string }}
     */
    add(name) {
      // Validate via the validator module (checks empty, length, duplicates)
      const validation = validator.validateCategory(name, categoryManager.getAll());
      if (!validation.valid) {
        return { ok: false, error: validation.error };
      }

      // Enforce the 20-custom-category limit
      if (customCategories.length >= MAX_CUSTOM_CATEGORIES) {
        return { ok: false, error: 'Category limit reached (max 20 custom categories).' };
      }

      // Add to in-memory custom list
      customCategories.push(name.trim());
      categories = [...BUILTIN_CATEGORIES, ...customCategories];

      // Persist — on failure revert the in-memory change and surface the error
      const saveResult = storage.saveCategories(customCategories);
      if (!saveResult.ok) {
        customCategories.pop();
        categories = [...BUILTIN_CATEGORIES, ...customCategories];
        return { ok: false, error: saveResult.error };
      }

      return { ok: true };
    },
  };

  // ─────────────────────────────────────────────
  // Transaction Manager Module
  // ─────────────────────────────────────────────

  /**
   * Generate a UUID v4. Uses crypto.randomUUID() when available,
   * falls back to a Math.random()-based implementation for older browsers.
   * @returns {string}
   */
  function generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    // Fallback: RFC 4122 v4 UUID via Math.random()
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  const txManager = {
    /**
     * Initialise: load transactions from storage.
     * On parse/read failure, initialises with an empty list and surfaces the
     * error so the render layer can show a banner.
     * @returns {{ ok: true } | { ok: false, error: string }}
     */
    init() {
      const result = storage.load();
      if (!result.ok) {
        transactions = [];
        return { ok: false, error: result.error };
      }
      transactions = result.data;
      return { ok: true };
    },

    /**
     * Return a shallow copy of the current transaction list.
     * @returns {object[]}
     */
    getAll() {
      return transactions.slice();
    },

    /**
     * Add a new transaction.
     * Generates a UUID and ISO createdAt timestamp, appends to the in-memory
     * array, and persists via storage.save(). If persistence fails the
     * transaction is KEPT in memory (Requirement 5.6) and { ok: false } is
     * returned so the render layer can show a warning banner.
     * @param {{ name: string, amount: number, category: string }} tx
     * @returns {{ ok: true, transaction: object } | { ok: false, error: string }}
     */
    add(tx) {
      const transaction = {
        id: generateId(),
        name: tx.name,
        amount: tx.amount,
        category: tx.category,
        createdAt: new Date().toISOString(),
      };

      transactions.push(transaction);

      const saveResult = storage.save(transactions);
      if (!saveResult.ok) {
        // Keep transaction in memory but notify the render layer
        return { ok: false, error: saveResult.error };
      }

      return { ok: true, transaction };
    },

    /**
     * Remove a transaction by id.
     * Splices the item from the in-memory array, calls storage.save(). If
     * persistence fails, the transaction is re-inserted at its original index
     * and { ok: false } is returned (Requirement 2.6).
     * @param {string} id
     * @returns {{ ok: true } | { ok: false, error: string }}
     */
    remove(id) {
      const index = transactions.findIndex(function (tx) { return tx.id === id; });
      if (index === -1) {
        return { ok: false, error: 'Transaction not found.' };
      }

      // Splice out the transaction, keeping a reference for possible revert
      const removed = transactions.splice(index, 1)[0];

      const saveResult = storage.save(transactions);
      if (!saveResult.ok) {
        // Revert: re-insert at the original position
        transactions.splice(index, 0, removed);
        return { ok: false, error: saveResult.error };
      }

      return { ok: true };
    },
  };

  // ─────────────────────────────────────────────
  // Compute Module (pure functions)
  // ─────────────────────────────────────────────

  const compute = {
    /**
     * Format an integer amount as IDR string.
     * Uses period (.) as thousands separator with no decimal places.
     * @param {number} amount — non-negative integer
     * @returns {string} e.g. "Rp 12.500"
     */
    formatIDR(amount) {
      // Convert to integer to guard against accidental floats
      const intAmount = Math.floor(amount);
      // Build period-separated thousands grouping without relying on locale
      const str = String(intAmount);
      let result = '';
      const offset = str.length % 3;
      for (let i = 0; i < str.length; i++) {
        if (i > 0 && (i - offset) % 3 === 0) {
          result += '.';
        }
        result += str[i];
      }
      return 'Rp ' + result;
    },

    /**
     * Sum all transaction amounts.
     * @param {object[]} txList
     * @returns {number}
     */
    totalBalance(txList) {
      return txList.reduce(function (sum, tx) {
        return sum + tx.amount;
      }, 0);
    },

    /**
     * Return a Map<category, total> excluding zero-sum categories.
     * @param {object[]} txList
     * @returns {Map<string, number>}
     */
    categoryTotals(txList) {
      const map = new Map();
      for (const tx of txList) {
        map.set(tx.category, (map.get(tx.category) || 0) + tx.amount);
      }
      // Exclude categories whose total is zero
      for (const [key, val] of map) {
        if (val === 0) {
          map.delete(key);
        }
      }
      return map;
    },

    /**
     * Sort transactions by the given field and direction.
     * Does NOT mutate the input array — returns a new sorted array.
     * Returns original order when field is null.
     * @param {object[]} txList
     * @param {{ field: 'amount' | 'category' | null, direction: 'asc' | 'desc' }} opts
     * @returns {object[]}
     */
    sortTransactions(txList, { field, direction }) {
      if (!field) {
        return txList.slice();
      }
      const copy = txList.slice();
      const dir = direction === 'desc' ? -1 : 1;
      copy.sort(function (a, b) {
        if (field === 'amount') {
          return dir * (a.amount - b.amount);
        }
        if (field === 'category') {
          const ca = a.category.toLowerCase();
          const cb = b.category.toLowerCase();
          if (ca < cb) return -1 * dir;
          if (ca > cb) return 1 * dir;
          return 0;
        }
        return 0;
      });
      return copy;
    },

    /**
     * Group transactions into monthly summaries in reverse chronological order.
     * @param {object[]} txList
     * @returns {{ label: string, total: number }[]}
     */
    monthlySummary(txList) {
      const MONTH_NAMES = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
      ];
      /** @type {Map<string, { label: string, total: number, sortKey: number }>} */
      const map = new Map();

      for (const tx of txList) {
        const d = new Date(tx.createdAt);
        const year = d.getFullYear();
        const month = d.getMonth(); // 0-based
        const key = year + '-' + String(month).padStart(2, '0');
        if (!map.has(key)) {
          map.set(key, {
            label: MONTH_NAMES[month] + ' ' + year,
            total: 0,
            sortKey: year * 100 + month,
          });
        }
        map.get(key).total += tx.amount;
      }

      // Sort descending (most recent first)
      return Array.from(map.values())
        .sort(function (a, b) { return b.sortKey - a.sortKey; })
        .map(function (entry) { return { label: entry.label, total: entry.total }; });
    },
  };

  // ─────────────────────────────────────────────
  // Chart Manager Module
  // ─────────────────────────────────────────────

  /**
   * Predefined color palette for pie/doughnut slices.
   * Cycles through the array when there are more categories than colors.
   */
  const CHART_COLORS = [
    '#FF6384', // rose
    '#36A2EB', // blue
    '#FFCE56', // yellow
    '#4BC0C0', // teal
    '#9966FF', // purple
    '#FF9F40', // orange
    '#C9CBCF', // grey
    '#E7E9ED', // light grey
    '#71B37C', // green
    '#E74C3C', // red
    '#3498DB', // sky blue
    '#F39C12', // amber
  ];

  const chartManager = {
    /** @type {Chart | null} */
    _instance: null,

    /** @type {string | null} — canvas id stored for re-init if needed */
    _canvasId: null,

    /**
     * Create the Chart.js doughnut instance on the given canvas id.
     * If an instance already exists it is destroyed first to avoid duplicate
     * canvas registrations.
     * @param {string} canvasId
     */
    init(canvasId) {
      // Destroy any existing instance before (re-)creating
      chartManager.destroy();

      chartManager._canvasId = canvasId;
      const canvas = document.getElementById(canvasId);
      if (!canvas) {
        return;
      }

      chartManager._instance = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: [],
          datasets: [
            {
              data: [],
              backgroundColor: [],
              borderWidth: 2,
              borderColor: '#ffffff',
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                font: { size: 14 },
                padding: 16,
              },
            },
            tooltip: {
              callbacks: {
                /**
                 * Show both the IDR-formatted total and the percentage in the
                 * tooltip so the chart labels stay uncluttered.
                 */
                label: function (context) {
                  const label = context.label || '';
                  const pct = context.parsed;
                  return ' ' + label + ': ' + pct + '%';
                },
              },
            },
          },
        },
      });
    },

    /**
     * Update the chart from a Map<category, total>.
     * Computes per-category percentages (rounded to 1 decimal place), then
     * refreshes labels, data, and background colours before calling
     * chart.update() so Chart.js animates the transition.
     * @param {Map<string, number>} categoryTotalsMap
     */
    update(categoryTotalsMap) {
      if (!chartManager._instance) {
        return;
      }

      if (!categoryTotalsMap || categoryTotalsMap.size === 0) {
        // Clear the chart data when there is nothing to show
        chartManager._instance.data.labels = [];
        chartManager._instance.data.datasets[0].data = [];
        chartManager._instance.data.datasets[0].backgroundColor = [];
        chartManager._instance.update();
        return;
      }

      // Calculate the grand total for percentage computation
      let grandTotal = 0;
      categoryTotalsMap.forEach(function (value) {
        grandTotal += value;
      });

      const labels = [];
      const data = [];
      const colors = [];
      let colorIndex = 0;

      categoryTotalsMap.forEach(function (value, key) {
        const pct = grandTotal > 0
          ? Math.round((value / grandTotal) * 1000) / 10  // 1 decimal place
          : 0;
        // Label shows category name + percentage (e.g. "Food 33.3%")
        labels.push(key + ' ' + pct + '%');
        data.push(pct);
        colors.push(CHART_COLORS[colorIndex % CHART_COLORS.length]);
        colorIndex++;
      });

      chartManager._instance.data.labels = labels;
      chartManager._instance.data.datasets[0].data = data;
      chartManager._instance.data.datasets[0].backgroundColor = colors;
      chartManager._instance.update();
    },

    /**
     * Destroy the Chart.js instance if one exists and reset the reference.
     */
    destroy() {
      if (chartManager._instance) {
        chartManager._instance.destroy();
        chartManager._instance = null;
      }
    },
  };

  // ─────────────────────────────────────────────
  // Render Module
  // ─────────────────────────────────────────────

  /** @type {number | null} — setTimeout handle for the auto-dismiss timer */
  let errorBannerTimer = null;

  const render = {
    // ── 10.1 Balance ────────────────────────────────────────────────────────

    /** Update the balance display element. */
    balance() {
      const el = document.getElementById('balance-display');
      if (!el) return;
      const total = compute.totalBalance(txManager.getAll());
      el.textContent = compute.formatIDR(total);
    },

    // ── 10.2 Transaction List ────────────────────────────────────────────────

    /** Re-render the transaction list. */
    transactionList() {
      const list           = document.getElementById('transaction-list');
      const summarySection = document.getElementById('summary-section');
      const sortControls   = document.getElementById('sort-controls');
      if (!list) return;

      // Toggle between transaction list and monthly summary view.
      // The outer card (#transaction-list-section) always stays visible.
      if (list)          list.hidden          = (activeView !== 'list');
      if (summarySection) summarySection.hidden = (activeView !== 'summary');
      // Sort/filter controls are only relevant for the transaction list view
      if (sortControls)  sortControls.hidden  = (activeView !== 'list');

      let txList = txManager.getAll();

      // Apply category filter when a specific category is selected
      if (categoryFilter) {
        txList = txList.filter(function (tx) { return tx.category === categoryFilter; });
      }

      // Apply amount sort when a sort criterion is selected
      if (sortState.field) {
        txList = compute.sortTransactions(txList, sortState);
      }

      // Clear current list content
      list.innerHTML = '';

      if (txList.length === 0) {
        const emptyMsg = document.createElement('li');
        emptyMsg.id = 'no-transactions-msg';
        emptyMsg.textContent = 'No transactions added yet.';
        list.appendChild(emptyMsg);
        return;
      }

      for (const tx of txList) {
        const li = document.createElement('li');
        li.className = 'transaction-item';
        li.dataset.id = tx.id;

        li.innerHTML =
          '<span class="tx-name">' + _escapeHtml(tx.name) + '</span>' +
          '<span class="tx-category" data-category="' + _escapeHtml(tx.category) + '">' + _escapeHtml(tx.category) + '</span>' +
          '<span class="tx-amount">' + compute.formatIDR(tx.amount) + '</span>' +
          '<button class="btn-delete" data-id="' + tx.id + '" aria-label="Delete transaction ' + _escapeHtml(tx.name) + '">' +
            '<svg class="btn-delete__icon" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>' +
            'Delete' +
          '</button>';

        list.appendChild(li);
      }
    },

    // ── 10.3 Pie Chart ───────────────────────────────────────────────────────

    /** Update the pie chart (or show empty message). */
    pieChart() {
      const canvas    = document.getElementById('pie-chart');
      const noDataMsg = document.getElementById('no-chart-msg');
      const txList    = txManager.getAll();

      if (txList.length === 0) {
        // No data — hide canvas, show placeholder text
        if (canvas)    canvas.hidden    = true;
        if (noDataMsg) noDataMsg.hidden = false;
        chartManager.update(new Map());
        return;
      }

      // Data present — show canvas, hide placeholder text
      if (canvas)    canvas.hidden    = false;
      if (noDataMsg) noDataMsg.hidden = true;

      const totals = compute.categoryTotals(txList);
      chartManager.update(totals);
    },

    // ── 10.4 Category Dropdown ───────────────────────────────────────────────

    /** Populate the category <select> with options from categoryManager. */
    categoryDropdown() {
      const select = document.getElementById('input-category');
      if (!select) return;

      // Remember current selection so we can try to restore it
      const currentValue = select.value;

      // Rebuild options — first the default placeholder
      select.innerHTML = '<option value="" disabled selected>-- Select a category --</option>';

      for (const cat of categoryManager.getAll()) {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        select.appendChild(opt);
      }

      // Restore previous selection if it still exists in the list
      if (currentValue) {
        select.value = currentValue;
        // If the value is no longer valid, fall back to placeholder
        if (select.value !== currentValue) {
          select.value = '';
        }
      }

      // Keep the category filter dropdown in sync with the current category list
      render.categoryFilterDropdown();
    },

    /** Populate the #filter-category <select> with the current category list. */
    categoryFilterDropdown() {
      const filterSelect = document.getElementById('filter-category');
      if (!filterSelect) return;

      // Remember the active filter so we can restore it after rebuilding
      const currentFilter = filterSelect.value;

      // Rebuild — always start with "All Categories"
      filterSelect.innerHTML = '<option value="">All Categories</option>';

      for (const cat of categoryManager.getAll()) {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        filterSelect.appendChild(opt);
      }

      // Restore the previously selected filter if it still exists
      filterSelect.value = currentFilter;
      if (filterSelect.value !== currentFilter) {
        // Category was removed — reset filter state too
        filterSelect.value = '';
        categoryFilter = '';
      }
    },

    // ── 10.5 Error helpers ───────────────────────────────────────────────────

    /**
     * Show a global error banner (auto-dismissed after 5 s).
     * @param {string} message
     */
    showError(message) {
      const banner = document.getElementById('error-banner');
      if (!banner) return;

      // Cancel any existing auto-dismiss timer
      if (errorBannerTimer !== null) {
        clearTimeout(errorBannerTimer);
        errorBannerTimer = null;
      }

      banner.textContent = message;
      banner.hidden = false;

      // Auto-dismiss after 5 seconds
      errorBannerTimer = setTimeout(function () {
        render.clearErrors();
      }, 5000);
    },

    /** Hide and clear the global error banner. */
    clearErrors() {
      const banner = document.getElementById('error-banner');
      if (banner) {
        banner.hidden = true;
        banner.textContent = '';
      }
      if (errorBannerTimer !== null) {
        clearTimeout(errorBannerTimer);
        errorBannerTimer = null;
      }
    },

    /**
     * Show an inline error adjacent to a form field.
     * Removes any existing error for this field first.
     * @param {string} fieldId
     * @param {string} message
     */
    showFieldError(fieldId, message) {
      const field = document.getElementById(fieldId);
      if (!field) return;

      // Remove an existing error for this field to avoid duplicates
      const existingError = field.parentNode.querySelector('.field-error[data-for="' + fieldId + '"]');
      if (existingError) {
        existingError.remove();
      }

      const span = document.createElement('span');
      span.className = 'field-error';
      span.dataset.for = fieldId;
      span.setAttribute('role', 'alert');
      span.textContent = message;

      // Insert the error span immediately after the field
      field.insertAdjacentElement('afterend', span);
    },

    /** Remove all inline field-error spans from the DOM. */
    clearFieldErrors() {
      const errors = document.querySelectorAll('.field-error');
      errors.forEach(function (el) { el.remove(); });
    },

    // ── 10.6 Monthly Summary ─────────────────────────────────────────────────

    /** Render monthly summary section (only when activeView === 'summary'). */
    monthlySummary() {
      const summarySection = document.getElementById('summary-section');
      const container      = document.getElementById('monthly-summary-list');
      if (!summarySection || !container) return;

      // Visibility is managed by render.transactionList() via the activeView flag;
      // still guard here so this function is self-contained.
      if (activeView !== 'summary') return;

      const summaries = compute.monthlySummary(txManager.getAll());

      container.innerHTML = '';

      if (summaries.length === 0) {
        const msg = document.createElement('p');
        msg.id = 'no-summary-msg';
        msg.textContent = 'No spending data available.';
        container.appendChild(msg);
        return;
      }

      for (const entry of summaries) {
        const row = document.createElement('div');
        row.className = 'summary-row';
        row.innerHTML =
          '<span class="summary-label">' + _escapeHtml(entry.label) + '</span>' +
          '<span class="summary-total">' + compute.formatIDR(entry.total) + '</span>';
        container.appendChild(row);
      }
    },

    // ── 10.7 Sort Controls ───────────────────────────────────────────────────

    /** Sync the sort and filter dropdowns to reflect current state. */
    sortControls() {
      const amountSelect   = document.getElementById('sort-amount');
      const categorySelect = document.getElementById('filter-category');

      if (amountSelect) {
        // Map sortState back to the dropdown value
        if (sortState.field === 'amount') {
          amountSelect.value = sortState.direction; // 'asc' or 'desc'
        } else {
          amountSelect.value = '';
        }
      }

      if (categorySelect) {
        categorySelect.value = categoryFilter;
        // Guard: if the value isn't present in the options (e.g. after a reset)
        // fall back to empty so the select isn't blank
        if (categorySelect.value !== categoryFilter) {
          categorySelect.value = '';
        }
      }
    },

    // ── 10.8 Full Re-render ──────────────────────────────────────────────────

    /** Full re-render: calls all sub-render functions in order. */
    all() {
      render.balance();
      render.transactionList();
      render.pieChart();
      render.categoryDropdown();
      render.categoryFilterDropdown();
      render.monthlySummary();
      render.sortControls();
    },
  };

  // ─────────────────────────────────────────────
  // Utility helpers (used by render module)
  // ─────────────────────────────────────────────

  /**
   * Escape HTML special characters to prevent XSS when building innerHTML.
   * @param {string} str
   * @returns {string}
   */
  function _escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ─────────────────────────────────────────────
  // Event Bindings
  // ─────────────────────────────────────────────

  function bindEvents() {
    // ── 11.1 Transaction form submission ────────────────────────────────────
    var txForm = document.getElementById('transaction-form');
    if (txForm) {
      txForm.addEventListener('submit', function (e) {
        e.preventDefault();

        // Clear previous inline field errors
        render.clearFieldErrors();

        var name     = document.getElementById('input-name').value;
        var amount   = document.getElementById('input-amount').value;
        var category = document.getElementById('input-category').value;

        // Validate inputs
        var validation = validator.validateTransaction({ name: name, amount: amount, category: category });

        if (!validation.valid) {
          // Show per-field inline errors
          if (validation.errors.name) {
            render.showFieldError('input-name', validation.errors.name);
          }
          if (validation.errors.amount) {
            render.showFieldError('input-amount', validation.errors.amount);
          }
          if (validation.errors.category) {
            render.showFieldError('input-category', validation.errors.category);
          }
          return;
        }

        // Add transaction — amount stored as integer
        var result = txManager.add({
          name: name.trim(),
          amount: Number(amount),
          category: category,
        });

        if (!result.ok) {
          // Storage write failed — transaction retained in memory; show warning
          render.showError(result.error);
        }

        // Re-render regardless (transaction is in memory even on storage failure)
        render.all();

        // Reset form on success
        txForm.reset();
        // Restore placeholder state of the category dropdown
        var categorySelect = document.getElementById('input-category');
        if (categorySelect) {
          categorySelect.value = '';
        }
      });
    }

    // ── 11.2 Transaction deletion (event delegation) ─────────────────────────
    var txList = document.getElementById('transaction-list');
    if (txList) {
      txList.addEventListener('click', function (e) {
        var btn = e.target.closest('.btn-delete');
        if (!btn) return;

        var id = btn.dataset.id;
        if (!id) return;

        var result = txManager.remove(id);

        if (!result.ok) {
          // Storage failure — txManager already reverted; show error
          render.showError(result.error);
        }

        // Re-render to reflect removal (or revert)
        render.all();
      });
    }

    // ── 11.3 Custom category addition ───────────────────────────────────────
    var categoryForm = document.getElementById('category-form');
    if (categoryForm) {
      categoryForm.addEventListener('submit', function (e) {
        e.preventDefault();

        // Clear any existing field error for the category input
        render.clearFieldErrors();

        var input = document.getElementById('input-custom-category');
        var name  = input ? input.value : '';

        // Validate the new category name against the current list
        var validation = validator.validateCategory(name, categoryManager.getAll());

        if (!validation.valid) {
          render.showFieldError('input-custom-category', validation.error);
          return;
        }

        // Add to category manager
        var result = categoryManager.add(name);

        if (!result.ok) {
          render.showFieldError('input-custom-category', result.error);
          return;
        }

        // Update the category dropdown to include the new option
        render.categoryDropdown();

        // Reset the category input field
        categoryForm.reset();
      });
    }

    // ── 11.4 View toggle (Transaction List ↔ Monthly Summary) ───────────────
    var btnViewList    = document.getElementById('btn-view-list');
    var btnViewSummary = document.getElementById('btn-view-summary');

    if (btnViewList) {
      btnViewList.addEventListener('click', function () {
        activeView = 'list';
        // Update aria-pressed on toggle buttons
        btnViewList.setAttribute('aria-pressed', 'true');
        btnViewList.classList.add('active');
        if (btnViewSummary) {
          btnViewSummary.setAttribute('aria-pressed', 'false');
          btnViewSummary.classList.remove('active');
        }
        render.all();
      });
    }

    if (btnViewSummary) {
      btnViewSummary.addEventListener('click', function () {
        activeView = 'summary';
        // Update aria-pressed on toggle buttons
        btnViewSummary.setAttribute('aria-pressed', 'true');
        btnViewSummary.classList.add('active');
        if (btnViewList) {
          btnViewList.setAttribute('aria-pressed', 'false');
          btnViewList.classList.remove('active');
        }
        render.all();
      });
    }

    // ── 11.5 Sort and filter dropdowns ──────────────────────────────────────
    var amountSortSelect   = document.getElementById('sort-amount');
    var categoryFilterSelect = document.getElementById('filter-category');

    if (amountSortSelect) {
      amountSortSelect.addEventListener('change', function () {
        var val = amountSortSelect.value;
        if (val === 'asc' || val === 'desc') {
          sortState.field     = 'amount';
          sortState.direction = val;
        } else {
          // "No Sorting" selected
          sortState.field     = null;
          sortState.direction = 'asc';
        }
        render.transactionList();
        render.sortControls();
      });
    }

    if (categoryFilterSelect) {
      categoryFilterSelect.addEventListener('change', function () {
        categoryFilter = categoryFilterSelect.value; // '' means All Categories
        render.transactionList();
        render.sortControls();
      });
    }
  }

  // ─────────────────────────────────────────────
  // App Initialisation
  // ─────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    // ── 11.6 Full initialisation ─────────────────────────────────────────────

    // Check persistence availability — show persistent warning if unavailable
    if (!storage.isAvailable()) {
      render.showError('Data persistence is unavailable. Running in session-only mode.');
    }

    // Load transactions — on corrupted data show error and initialize empty
    var txInitResult = txManager.init();
    if (!txInitResult.ok) {
      render.showError(txInitResult.error);
    }

    // Load custom categories (failures silently fall back to empty list)
    categoryManager.init();

    // Set up Chart.js doughnut instance
    chartManager.init('pie-chart');

    // Full initial render
    render.all();

    // Attach all event listeners
    bindEvents();
  });

}());
