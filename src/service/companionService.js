/**
 * Manages in-memory live companion state, auto-move commands, and listener subscriptions for real-time board sync.
 *
 * @returns {{
 *   updateSnapshot: (snapshot: any) => any,
 *   getLatestSnapshot: () => any | null,
 *   setAutoMoveCommand: (command: any) => any,
 *   getLatestAutoMoveCommand: () => any | null,
 *   clearAutoMoveCommand: () => void,
 *   subscribe: (listener: (payload: any, eventName?: string) => void) => () => void,
 *   reset: () => void,
 * }} Companion service interface.
 */
export function createCompanionService() {
  let latestSnapshot = null;
  let latestAutoMoveCommand = null;
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
        listener(snapshot, 'companion:update');
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
   * Stores a new auto-move command and broadcasts it to active subscribers.
   *
   * @param {any} command - Validated auto-move command payload.
   * @returns {any} Stored auto-move command.
   */
  function setAutoMoveCommand(command) {
    latestAutoMoveCommand = command;
    for (const listener of subscribers) {
      try {
        listener(command, 'companion:auto-move');
      } catch (err) {
        // Isolate subscriber errors so one failing listener never disrupts others
        console.error('Companion subscriber auto-move callback failed:', err);
      }
    }
    return latestAutoMoveCommand;
  }

  /**
   * Retrieves the current pending auto-move command.
   *
   * @returns {any | null} Latest command or null when none is pending.
   */
  function getLatestAutoMoveCommand() {
    return latestAutoMoveCommand;
  }

  /**
   * Clears the current pending auto-move command.
   *
   * @returns {void}
   */
  function clearAutoMoveCommand() {
    latestAutoMoveCommand = null;
  }

  /**
   * Registers a subscriber callback for companion events and board updates.
   *
   * @param {(payload: any, eventName?: string) => void} listener - Callback invoked with new payloads.
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
   * Clears the stored snapshot and pending auto-move command.
   *
   * @returns {void}
   */
  function reset() {
    latestSnapshot = null;
    latestAutoMoveCommand = null;
  }

  return {
    updateSnapshot,
    getLatestSnapshot,
    setAutoMoveCommand,
    getLatestAutoMoveCommand,
    clearAutoMoveCommand,
    subscribe,
    reset,
  };
}

