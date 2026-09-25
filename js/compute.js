/**
 * js/compute.js — Pure compute functions for the Expense & Budget Visualizer.
 * Exported as an ES module for testability; the same implementations are also
 * inlined inside the IIFE in js/app.js for the browser runtime (no bundler).
 */

/**
 * Format a non-negative integer as an IDR currency string.
 * Uses period (.) as thousands separator, no decimal places.
 * @param {number} amount — non-negative integer
 * @returns {string} e.g. "Rp 12.500"
 */
export function formatIDR(amount) {
  const intAmount = Math.floor(amount);
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
}

/**
 * Sum all transaction amount fields.
 * @param {object[]} txList
 * @returns {number}
 */
export function totalBalance(txList) {
  return txList.reduce(function (sum, tx) {
    return sum + tx.amount;
  }, 0);
}

/**
 * Return a Map<category, total> keyed by category with summed amounts.
 * Categories with a zero total are excluded.
 * @param {object[]} txList
 * @returns {Map<string, number>}
 */
export function categoryTotals(txList) {
  const map = new Map();
  for (const tx of txList) {
    map.set(tx.category, (map.get(tx.category) || 0) + tx.amount);
  }
  for (const [key, val] of map) {
    if (val === 0) {
      map.delete(key);
    }
  }
  return map;
}

/**
 * Sort transactions by the given field and direction.
 * Does NOT mutate the input array — returns a new sorted copy.
 * Returns a copy in original order when field is null.
 * @param {object[]} txList
 * @param {{ field: 'amount' | 'category' | null, direction: 'asc' | 'desc' }} opts
 * @returns {object[]}
 */
export function sortTransactions(txList, { field, direction }) {
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
}

/**
 * Group transactions by calendar month/year.
 * Returns entries in reverse chronological order (most recent first).
 * @param {object[]} txList
 * @returns {{ label: string, total: number }[]}
 */
export function monthlySummary(txList) {
  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
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

  return Array.from(map.values())
    .sort(function (a, b) { return b.sortKey - a.sortKey; })
    .map(function (entry) { return { label: entry.label, total: entry.total }; });
}
