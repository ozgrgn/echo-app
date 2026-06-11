/**
 * @talkwo/echo-core — Shared library.
 * Safe to import from both frontend (echo-panel) and backend (absa-service, echo-backend).
 *
 * Contains: domain types, taxonomy, scoring model, absa contract.
 * Does NOT contain: HTTP client, mock data, UI adapters → those live in @talkwo/echo-ui.
 */
export * from './types.js';
export * from './categories.js';
export * from './scoring.js';
export * from './absa-contract.js';
