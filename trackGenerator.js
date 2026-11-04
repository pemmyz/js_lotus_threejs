/* ===================================================
   AMIGA TURBO RACER - PROCEDURAL TRACK GENERATOR
   Generates mathematical track profiles, Catmull-Rom
   splines, NASCAR superspeedways, and circuit layouts.
   =================================================== */

window.ATR = window.ATR || {};

class TrackGenerator {
  constructor() {
    this.roadWidth = 14;
    this.shoulderWidth = 2.4;
  }

  createPRNG(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function() {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  generate(seed = 849271, difficulty = 'MEDIUM', envType = 'FOREST', numWaypoints = 72, mapLayout = 'ORIGINAL', counterClockwise = false) {
    // =========================================================
    // 0. LOTUS ENDLESS NEVER-ENDING HIGHWAY (NORMAL & SUPERWIDE)
    // =========================================================
    if (mapLayout === 'LOTUS' || mapLayout === 'LOTUS_SUPERWIDE') {
      return {
        isInfinite: true,
        seed,
        envType: 'FOREST',
        mapLayout,
        totalLength: 999999999,
        counterClockwise: false
      };
    }

    const random = this.createPRNG(seed);
    const controlPoints = [];

    // =========================================================
    // 1. PURE NASCAR SUPERSPEEDWAY OVAL GENERATOR
    // =========================================================
    if (mapLayout === 'OVAL') {
      const straightLen = 720;
      const turnRadius = 220;
      const semiCircumference = Math.PI * turnRadius;
      const totalPerimeter = 2 * straightLen + 2 * semiCircumference;

      const ovalWaypoints = 120;
      for (let i = 0; i < ovalWaypoints; i++) {
        const step = counterClockwise ? ((ovalWaypoints - i) % ovalWaypoints) : i;
        const s = (step / ovalWaypoints) * totalPerimeter;
        let x = 0;
        let z = 0;

        if (s < straightLen) {
          const frac = s / straightLen;
          x = turnRadius;
          z = (straightLen / 2) - frac * straightLen;
        } else if (s < straightLen + semiCircumference) {
          const arcS = s - straightLen;
          const phi = arcS / turnRadius;
          x = turnRadius * Math.cos(phi);
          z = -straightLen / 2 - turnRadius * Math.sin(phi);
        } else if (s < 2 * straightLen + semiCircumference) {
          const frac = (s - (straightLen + semiCircumference)) / straightLen;
          x = -turnRadius;
          z = -straightLen / 2 + frac * straightLen;
        } else {
          const arcS = s - (2 * straightLen + semiCircumference);
          const phi = Math.PI + (arcS / turnRadius);
          x = turnRadius * Math.cos(phi);
          z = straightLen / 2 - turnRadius * Math.sin(phi);
        }

        controlPoints.push(new THREE.Vector3(x, 9.5, z));
      }

      const spline = new THREE.CatmullRomCurve3(controlPoints, true, 'centripetal');

      return {
        controlPoints,
        spline,
        totalLength: spline.getLength(),
        seed,
        envType,
        mapLayout,
        counterClockwise: !!counterClockwise
      };
    }

    // =========================================================
    // 2. STANDARD PROCEDURAL ROAD CIRCUITS
    // =========================================================
    const rawRadii = new Float32Array(numWaypoints);
    const elevations = new Float32Array(numWaypoints);

    const p1 = random() * Math.PI * 2;
    const p2 = random() * Math.PI * 2;
    let hillScale = difficulty === 'HARD' ? 13.0 : 8.0;

    if (mapLayout === 'ALPINE') {
      hillScale = difficulty === 'HARD' ? 16.5 : 11.0;
    } else if (mapLayout === 'MIDNIGHT') {
      hillScale = 4.5;
    } else if (mapLayout === 'DUNES') {
      hillScale = 7.0;
    } else if (mapLayout === 'TROPICAL') {
      hillScale = 6.5;
    }

    for (let i = 0; i < numWaypoints; i++) {
      let angle = (i / numWaypoints) * Math.PI * 2;
      if (counterClockwise) {
        angle = (((numWaypoints - i) % numWaypoints) / numWaypoints) * Math.PI * 2;
      }

      let r = 290;

      if (mapLayout === 'TROPICAL') {
        const rx = 245 + random() * 20;
        const rz = 365 + random() * 25;
        const base = (rx * rz) / Math.max(1, Math.hypot(rz * Math.sin(angle), rx * Math.cos(angle)));
        const islandEsses = Math.sin(angle * 3 + p1) * 48 + Math.cos(angle * 5 + p2) * 24;
        r = base + islandEsses;

      } else if (mapLayout === 'SERPENTINE') {
        const rx = 230 + random() * 25;
        const rz = 360 + random() * 30;
        const base = (rx * rz) / Math.max(1, Math.hypot(rz * Math.sin(angle), rx * Math.cos(angle)));
        const sCurves = Math.sin(angle * 4 + p1) * 52 + Math.cos(angle * 7 + p2) * 26;
        r = base + sCurves;

      } else if (mapLayout === 'DUNES') {
        const rx = 245 + Math.sin(angle) * 45;
        const rz = 370 + random() * 25;
        const base = (rx * rz) / Math.max(1, Math.hypot(rz * Math.sin(angle), rx * Math.cos(angle)));
        const dunesWiggle = Math.sin(angle * 3 + p1) * 54 + Math.cos(angle * 5) * 24;
        r = base + dunesWiggle;

      } else if (mapLayout === 'ALPINE') {
        const triLobe = Math.cos(angle * 3 + p1) * 62;
        const technical = Math.sin(angle * 6 + p2) * 26;
        r = 295 + triLobe + technical;

      } else if (mapLayout === 'FJORD') {
        const rx = 210 + random() * 20;
        const rz = 390 + random() * 30;
        const base = (rx * rz) / Math.max(1, Math.hypot(rz * Math.sin(angle), rx * Math.cos(angle)));
        const coastalBays = Math.cos(angle * 2 + p1) * 55 + Math.sin(angle * 5 + p2) * 28;
        r = base + coastalBays;

      } else if (mapLayout === 'MIDNIGHT') {
        const p = 3.2;
        const cosA = Math.cos(angle + p1);
        const sinA = Math.sin(angle + p1);
        const rx = 240 + random() * 25;
        const rz = 355 + random() * 30;
        const superR = 1.0 / Math.pow(Math.pow(Math.abs(cosA / rx), p) + Math.pow(Math.abs(sinA / rz), p), 1 / p);
        r = superR + Math.sin(angle * 4 + p2) * 32 + Math.cos(angle * 7) * 14;

      } else {
        const rx = 240 + random() * 30;
        const rz = 370 + random() * 35;
        const base = (rx * rz) / Math.max(1, Math.hypot(rz * Math.sin(angle), rx * Math.cos(angle)));
        r = base + Math.sin(angle * 2 + p1) * 38 + Math.cos(angle * 3 + p2) * 24;
      }

      const distFromStart = Math.min(angle, Math.PI * 2 - angle);
      const straightBlend = Math.min(1.0, distFromStart / 0.32);
      const neutralRadius = 310;
      r = neutralRadius * (1.0 - straightBlend) + r * straightBlend;

      rawRadii[i] = Math.max(185, Math.min(415, r));
      elevations[i] = Math.max(0, (Math.sin(angle * 3) * hillScale + Math.cos(angle * 5) * (hillScale * 0.45)) * straightBlend);
    }

    const maxDelta = 14.5;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < numWaypoints; i++) {
        const next = (i + 1) % numWaypoints;
        const diff = rawRadii[next] - rawRadii[i];
        if (Math.abs(diff) > maxDelta) {
          rawRadii[next] = rawRadii[i] + Math.sign(diff) * maxDelta;
        }
      }
    }

    const finalRadii = new Float32Array(numWaypoints);
    for (let i = 0; i < numWaypoints; i++) {
      const prev = (i - 1 + numWaypoints) % numWaypoints;
      const next = (i + 1) % numWaypoints;
      finalRadii[i] = rawRadii[prev] * 0.22 + rawRadii[i] * 0.56 + rawRadii[next] * 0.22;
    }

    for (let i = 0; i < numWaypoints; i++) {
      let angle = (i / numWaypoints) * Math.PI * 2;
      if (counterClockwise) {
        angle = (((numWaypoints - i) % numWaypoints) / numWaypoints) * Math.PI * 2;
      }
      const r = finalRadii[i];
      const x = Math.sin(angle) * r;
      const z = -Math.cos(angle) * r;
      const y = elevations[i];
      controlPoints.push(new THREE.Vector3(x, y, z));
    }

    const spline = new THREE.CatmullRomCurve3(controlPoints, true, 'centripetal');

    return {
      controlPoints,
      spline,
      totalLength: spline.getLength(),
      seed,
      envType,
      mapLayout,
      counterClockwise
    };
  }
}

window.ATR.TrackGenerator = TrackGenerator;
