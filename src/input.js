// ============================================================================
// INPUT  —  keyboard + mouse + pointer lock
// ----------------------------------------------------------------------------
// Tracks which keys are held, accumulates raw mouse movement while the pointer
// is locked, and handles click-to-lock. Other systems read from here; this file
// has no game logic of its own so it stays easy to reason about.
// ============================================================================

class Input {
  constructor(domElement) {
    this.dom = domElement;
    this.keys = Object.create(null);    // keys.KeyW === true while W is held
    this.pressed = Object.create(null); // edge: true on the frame a key goes down
    this.locked = false;                // is the pointer currently locked?
    this._mouseDX = 0;                  // mouse movement accumulated since last read
    this._mouseDY = 0;

    addEventListener('keydown', (e) => {
      if (!this.keys[e.code]) this.pressed[e.code] = true; // first frame of the press
      this.keys[e.code] = true;
      // Stop the page from scrolling when we use space / arrows in-game.
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });

    // Click the canvas to capture the mouse (first-person look).
    domElement.addEventListener('click', () => {
      if (!this.locked) domElement.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === domElement;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this._mouseDX += e.movementX;
      this._mouseDY += e.movementY;
    });
  }

  isDown(code) { return !!this.keys[code]; }

  // True once per physical key press (consumes the edge so it won't repeat).
  consumePressed(code) {
    if (this.pressed[code]) { this.pressed[code] = false; return true; }
    return false;
  }

  // Return accumulated mouse movement and reset it (call once per frame).
  consumeMouseDelta() {
    const d = { dx: this._mouseDX, dy: this._mouseDY };
    this._mouseDX = 0;
    this._mouseDY = 0;
    return d;
  }
}
