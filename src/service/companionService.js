/**
 * Manages in-memory live companion state and listener subscriptions for real-time board sync.
 *
 * @returns {{
 *   updateSnapshot: (snapshot: any) => any,
 *   getLatestSnapshot: () => any | null,
 *   subscribe: (listener: (snapshot: any) => void) => () => void,
 *   reset: () => void,
 * }} Companion service interface.
 */
export function createCompanionService() {
  let latestSnapshot = null;
  const subscribers = new Set();

  /**
   * Updates the latest board snapshot and broadcasts to all active subscribers.
   *
   * @param {any} snapshot - Normalized companion snapshot.
   * @returns {any} Stored snapshot.
   */
  function updateSnapshot(snapshot) {
    latestSnapshot = snapshot;
    for (const listener of subscribers) {
      try {
        listener(snapshot);
      } catch (err) {
        // Isolate subscriber errors so one failing listener never disrupts others
        console.error('Companion subscriber callback failed:', err);
      }
    }
    return latestSnapshot;
  }

  /**
   * Retrieves the most recently recorded companion snapshot.
   *
   * @returns {any | null} Latest snapshot or null if no sync has occurred.
   */
  function getLatestSnapshot() {
    return latestSnapshot;
  }

  /**
   * Registers a subscriber callback for new companion board updates.
   *
   * @param {(snapshot: any) => void} listener - Callback invoked with new snapshots.
   * @returns {() => void} Unsubscribe function to release the listener.
   */
  function subscribe(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }
    subscribers.add(listener);
    return () => {
      subscribers.delete(listener);
    };
  }

  /**
   * Clears the stored snapshot.
   *
   * @returns {void}
   */
  function reset() {
    latestSnapshot = null;
  }

  return {
    updateSnapshot,
    getLatestSnapshot,
    subscribe,
    reset,
  };
}

