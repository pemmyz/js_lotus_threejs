/* ===================================================
   AMIGA TURBO RACER - PIXEL RESOLUTION CONTROLLER
   =================================================== */

window.ATR = window.ATR || {};

class PixelResolutionController {
  constructor(renderer, canvas = renderer.domElement, pixelScale = 0.25) {
    this.renderer = renderer;
    this.canvas = canvas;
    this.pixelScale = pixelScale;
    this.isEnabled = false;

    window.addEventListener('resize', () => this.update());
  }

  setPixelMode(enabled) {
    this.isEnabled = enabled;
    if (this.canvas) {
      this.canvas.classList.toggle('pixel-art-canvas', enabled);
    }
    this.update();
  }

  toggle() {
    this.setPixelMode(!this.isEnabled);
    return this.isEnabled;
  }

  update() {
    if (!this.renderer) return;
    const width = window.innerWidth;
    const height = window.innerHeight;

    const ratio = this.isEnabled 
      ? this.pixelScale 
      : Math.min(window.devicePixelRatio || 1, 2);

    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height);
  }
}

window.ATR.PixelResolutionController = PixelResolutionController;
