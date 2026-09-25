/**
 * js/categoryManager.js — Category management for the Expense & Budget Visualizer.
 * Exported as an ES module for testability; the same implementations are also
 * inlined inside the IIFE in js/app.js for the browser runtime (no bundler).
 */

import { validateCategory } from './validator.js';

export const BUILTIN_CATEGORIES = ['Food', 'Transport', 'Fun'];
export const MAX_CUSTOM_CATEGORIES = 20;

/**
 * Create a fresh CategoryManager instance backed by the provided storage object.
 * The storage object must implement:
 *   loadCategories()       → { ok: true, data: string[] } | { ok: false, error: string }
 *   saveCategories(cats)   → { ok: true } | { ok: false, error: string }
 *
 * This factory pattern makes the manager fully testable without a real localStorage.
 *
 * @param {{ loadCategories: () => object, saveCategories: (cats: string[]) => object }} storageAdapter
 * @returns {{ init: Function, getAll: Function, add: Function }}
 */
export function createCategoryManager(storageAdapter) {
  /** @type {string[]} — only the user-defined custom categories */
  let customCategories = [];

  return {
    /**
     * Initialise: load custom categories from storage and prepend built-ins.
     * On storage failure, initialises with an empty custom list.
     */
    init() {
      const result = storageAdapter.loadCategories();
      if (!result.ok) {
        customCategories = [];
      } else {
        customCategories = Array.isArray(result.data) ? result.data : [];
      }
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
      // Validate via the validator module (checks empty, length, and duplicates)
      const validation = validateCategory(name, this.getAll());
      if (!validation.valid) {
        return { ok: false, error: validation.error };
      }

      // Enforce the 20-custom-category limit
      if (customCategories.length >= MAX_CUSTOM_CATEGORIES) {
        return { ok: false, error: 'Category limit reached (max 20 custom categories).' };
      }

      // Add to in-memory custom list
      customCategories.push(name.trim());

      // Persist — on failure revert the in-memory change and surface the error
      const saveResult = storageAdapter.saveCategories(customCategories);
      if (!saveResult.ok) {
        customCategories.pop();
        return { ok: false, error: saveResult.error };
      }

      return { ok: true };
    },
  };
}
