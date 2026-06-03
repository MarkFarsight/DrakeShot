// ============================================================================
// SAVE  —  tiny, robust localStorage wrapper
// ----------------------------------------------------------------------------
// Everything is wrapped in try/catch and gated on an availability probe, so if
// the browser blocks storage (e.g. some private-mode / file:// situations) the
// game keeps working — it just won't persist. `Save.available` tells the rest
// of the code whether persistence is on so it can warn the player.
// ============================================================================

const Save = (function () {
  const KEY = 'guncraft_save_v1';
  let available = false;
  try {
    const t = '__gc_probe__';
    localStorage.setItem(t, '1');
    localStorage.removeItem(t);
    available = true;
  } catch (e) {
    available = false;
  }

  return {
    available,

    write(state) {
      if (!available) return;
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* quota / blocked */ }
    },

    read() {
      if (!available) return null;
      try {
        const s = localStorage.getItem(KEY);
        return s ? JSON.parse(s) : null;
      } catch (e) {
        return null;
      }
    },

    clear() {
      if (!available) return;
      try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    },
  };
})();
