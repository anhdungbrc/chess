const TIME_CONTROLS = Object.freeze([
  Object.freeze({
    id: 'untimed',
    label: 'Untimed',
    category: 'untimed',
    initialMs: null,
    incrementMs: 0,
  }),
  Object.freeze({
    id: '1+0',
    label: '1 min',
    category: 'bullet',
    initialMs: 60 * 1000,
    incrementMs: 0,
  }),
  Object.freeze({
    id: '3+0',
    label: '3 min',
    category: 'blitz',
    initialMs: 3 * 60 * 1000,
    incrementMs: 0,
  }),
  Object.freeze({
    id: '3+2',
    label: '3 | 2',
    category: 'blitz',
    initialMs: 3 * 60 * 1000,
    incrementMs: 2 * 1000,
  }),
  Object.freeze({
    id: '10+0',
    label: '10 min',
    category: 'rapid',
    initialMs: 10 * 60 * 1000,
    incrementMs: 0,
  }),
]);

/**
 * Returns the supported Chess.com-style time control presets.
 *
 * @returns {ReadonlyArray<{ id: string, label: string, category: string, initialMs: number | null, incrementMs: number }>} Read-only list of time controls.
 */
export function listTimeControls() {
  return TIME_CONTROLS;
}

/**
 * Finds a time control preset by ID or returns null when unsupported.
 *
 * @param {string} timeControlId - Time control identifier such as 'untimed' or '3+2'.
 * @returns {{ id: string, label: string, category: string, initialMs: number | null, incrementMs: number } | null} Matching preset or null.
 */
export function findTimeControl(timeControlId) {
  if (typeof timeControlId !== 'string') {
    return null;
  }
  return TIME_CONTROLS.find((preset) => preset.id === timeControlId) ?? null;
}

