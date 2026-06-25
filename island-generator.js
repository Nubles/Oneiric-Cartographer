/**
 * Procedural Island Generator for Oneiric Cartographer
 * Uses a lightweight 2D Noise algorithm and shapes it using dream dimensions.
 */

(function(window) {
  // --- Standard 2D Perlin Noise Implementation ---
  const permutation = new Uint8Array(256);
  for (let i = 0; i < 256; i++) permutation[i] = Math.floor(Math.random() * 256);
  
  const p = new Uint8Array(512);
  for (let i = 0; i < 512; i++) {
    p[i] = permutation[i & 255];
  }

  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(t, a, b) { return a + t * (b - a); }
  function grad(hash, x, y) {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -2.0 * v : 2.0 * v);
  }

  function noise2D(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = fade(x);
    const v = fade(y);
    const A = p[X] + Y;
    const B = p[X + 1] + Y;

    return lerp(v, lerp(u, grad(p[A], x, y),
                         grad(p[B], x - 1, y)),
                   lerp(u, grad(p[A + 1], x, y - 1),
                         grad(p[B + 1], x - 1, y - 1)));
  }

  // Fractional Brownian Motion (fBm) for layered fractal noise
  function fbm(x, y, octaves, roughness) {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1.0;
    for (let i = 0; i < octaves; i++) {
      value += amplitude * noise2D(x * frequency, y * frequency);
      frequency *= 2.0;
      amplitude *= roughness;
    }
    return value;
  }

  // --- Dynamic Color Palette Generator based on Warmth ---
  function getPalette(warmth) {
    // Cool Palette (Warmth = 0) to Warm Palette (Warmth = 1)
    const palettes = {
      water: { r: 10, g: 15, b: 29 }, // Shared background
      shallows: lerpColor({r: 15, g: 35, b: 60}, {r: 35, g: 65, b: 60}, warmth),
      sand: lerpColor({r: 45, g: 75, b: 90}, {r: 215, g: 175, b: 125}, warmth),
      grass: lerpColor({r: 30, g: 85, b: 95}, {r: 165, g: 185, b: 105}, warmth),
      rock: lerpColor({r: 40, g: 65, b: 85}, {r: 155, g: 105, b: 85}, warmth),
      peak: lerpColor({r: 110, g: 150, b: 175}, {r: 235, g: 220, b: 210}, warmth)
    };
    return palettes;
  }

  function lerpColor(c1, c2, t) {
    return {
      r: Math.round(c1.r + t * (c2.r - c1.r)),
      g: Math.round(c1.g + t * (c2.g - c1.g)),
      b: Math.round(c1.b + t * (c2.b - c1.b))
    };
  }

  function rgbString(color, alpha = 1) {
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
  }

  // --- Island Generator class ---
  class Island {
    constructor(config) {
      this.id = config.id || Date.now() + Math.random().toString(36).substr(2, 5);
      this.title = config.title || "Unnamed Dream";
      this.notes = config.notes || "";
      this.date = config.date || new Date().toLocaleDateString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      
      // 5 Dimensions (0 to 100)
      this.lucidity = config.lucidity !== undefined ? config.lucidity : 50;
      this.chaos = config.chaos !== undefined ? config.chaos : 50;
      this.warmth = config.warmth !== undefined ? config.warmth : 50;
      this.gravity = config.gravity !== undefined ? config.gravity : 50;
      this.vertigo = config.vertigo !== undefined ? config.vertigo : 50;

      // Seed for deterministic noise variations
      this.seedX = config.seedX || Math.random() * 10000;
      this.seedY = config.seedY || Math.random() * 10000;

      // Drift physics variables
      this.x = config.x || 0; // Absolute map coordinates
      this.y = config.y || 0;
      this.vx = config.vx || 0;
      this.vy = config.vy || 0;
      this.radius = 120; // Collision/draw radius
    }

    // Evaluates elevation at a given local offset (dx, dy) from island center
    getElevation(dx, dy) {
      // Normalize offset relative to size
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      // Base falloff mask to ensure it's an island
      const maxDist = this.radius;
      if (dist >= maxDist) return 0;
      const mask = Math.pow(1 - dist / maxDist, 1.2 + (this.gravity / 100) * 1.5); // gravity shapes mask

      // Vertigo warp
      let evalX = dx / 45;
      let evalY = dy / 45;
      if (this.vertigo > 0) {
        const angle = noise2D(evalX * 0.5 + this.seedX, evalY * 0.5 + this.seedY) * (this.vertigo / 100) * Math.PI * 3;
        const rx = dx * Math.cos(angle) - dy * Math.sin(angle);
        const ry = dx * Math.sin(angle) + dy * Math.cos(angle);
        evalX = rx / 45;
        evalY = ry / 45;
      }

      // Chaos dictates octaves and roughness
      const octaves = Math.floor(2 + (this.chaos / 100) * 4); // 2 to 6 octaves
      const roughness = 0.4 + (this.chaos / 100) * 0.35; // 0.4 to 0.75

      // Evaluate fractal noise
      const n = fbm(evalX + this.seedX, evalY + this.seedY, octaves, roughness);
      
      // Combine noise and mask
      let elevation = (n + 0.5) * mask;
      return Math.max(0, Math.min(1, elevation));
    }

    /**
     * Renders the island to a canvas context
     */
    render(ctx, scale = 1, showDetails = false) {
      const pCount = 8; // Number of contour bands
      const radius = this.radius;
      const palette = getPalette(this.warmth / 100);

      // Lucidity controls the blur/glow and line sharpness
      const blurLevel = Math.max(0, (100 - this.lucidity) / 10);
      ctx.shadowBlur = blurLevel * scale;
      ctx.shadowColor = rgbString(palette.shallows, 0.4);

      // We will render concentric shapes starting from the lowest level (shoreline) to the peak
      const levels = [
        { limit: 0.05, color: palette.shallows, stroke: true },
        { limit: 0.12, color: palette.sand, stroke: false },
        { limit: 0.30, color: palette.grass, stroke: false },
        { limit: 0.50, color: palette.rock, stroke: false },
        { limit: 0.70, color: palette.peak, stroke: false }
      ];

      // Draw elevation layers
      levels.forEach((level) => {
        ctx.beginPath();
        const steps = 90; // High resolution polygon for smooth contours
        for (let i = 0; i <= steps; i++) {
          const angle = (i / steps) * Math.PI * 2;
          
          // Hunt for the contour radius along this angle using binary search
          let minR = 0;
          let maxR = radius;
          let r = radius / 2;
          for (let s = 0; s < 7; s++) { // 7 steps is precise enough
            const testX = r * Math.cos(angle);
            const testY = r * Math.sin(angle);
            const elev = this.getElevation(testX, testY);
            if (elev >= level.limit) {
              minR = r;
            } else {
              maxR = r;
            }
            r = (minR + maxR) / 2;
          }

          // Add a hand-drawn wobble factor based on chaos and lucidity
          const wobble = (Math.sin(angle * 12) + Math.cos(angle * 7)) * (this.chaos / 30) * (1 - this.lucidity / 150);
          const finalR = (r + wobble) * scale;
          
          const px = finalR * Math.cos(angle);
          const py = finalR * Math.sin(angle);

          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();

        ctx.fillStyle = rgbString(level.color);
        ctx.fill();

        // Draw topographic contour stroke
        ctx.strokeStyle = rgbString(palette.rock, 0.25 + (this.lucidity / 200));
        ctx.lineWidth = Math.max(0.5, 0.8 * scale);
        ctx.stroke();
      });

      // Draw peak contour lines (internal topological details)
      ctx.shadowBlur = 0; // Clear shadow
      
      const detailsCount = Math.floor(4 + (this.gravity / 20)); // High gravity = more contour lines
      for (let d = 1; d <= detailsCount; d++) {
        const threshold = 0.15 + (d / (detailsCount + 1)) * 0.75;
        ctx.beginPath();
        const steps = 72;
        let drawing = false;
        
        for (let i = 0; i <= steps; i++) {
          const angle = (i / steps) * Math.PI * 2;
          let minR = 0;
          let maxR = radius;
          let r = radius / 2;
          for (let s = 0; s < 7; s++) {
            const testX = r * Math.cos(angle);
            const testY = r * Math.sin(angle);
            if (this.getElevation(testX, testY) >= threshold) {
              minR = r;
            } else {
              maxR = r;
            }
            r = (minR + maxR) / 2;
          }

          if (r > 4) { // Don't draw points near zero center
            const px = r * scale * Math.cos(angle);
            const py = r * scale * Math.sin(angle);
            if (!drawing) {
              ctx.moveTo(px, py);
              drawing = true;
            } else {
              ctx.lineTo(px, py);
            }
          }
        }
        if (drawing) {
          ctx.strokeStyle = rgbString(palette.rock, 0.15 + (this.lucidity / 300));
          ctx.lineWidth = Math.max(0.4, 0.5 * scale);
          ctx.stroke();
        }
      }

      // Draw island label/marker if details are enabled
      if (showDetails) {
        ctx.font = `600 ${11 * scale}px var(--font-sans)`;
        ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
        ctx.textAlign = "center";
        ctx.fillText(this.title, 0, (radius + 20) * scale);
      }
    }
  }

  // Export to window
  window.Island = Island;

})(window);
