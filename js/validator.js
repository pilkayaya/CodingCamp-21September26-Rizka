/**
 * js/validator.js — Pure validator functions for the Expense & Budget Visualizer.
 * Exported as an ES module for testability; the same implementations are also
 * inlined inside the IIFE in js/app.js for the browser runtime (no bundler).
 */

/**
 * Validate a transaction input object.
 * @param {{ name: string, amount: any, category: string }} input
 * @returns {{ valid: true } | { valid: false, errors: { name?: string, amount?: string, category?: string } }}
 */
export function validateTransaction({ name, amount, category }) {
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
}

/**
 * Validate a new custom category name.
 * @param {string} name
 * @param {string[]} existingCategories
 * @returns {{ valid: true } | { valid: false, error: string }}
 */
export function validateCategory(name, existingCategories) {
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
}
