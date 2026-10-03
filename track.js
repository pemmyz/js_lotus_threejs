/* ===================================================
   AMIGA TURBO RACER - PROCEDURAL TRACK GENERATOR
   Creates dynamic 3D ribbon road geometry, Catmull-Rom
   spline elevation, roadside signs, scenery, banked corners,
   oval superspeedways, pit lane and procedural clouds.
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
        const s = (i / ovalWaypoints) * totalPerimeter;
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
        counterClockwise: false
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

class Track {
  constructor(scene, trackData) {
    this.scene = scene;
    this.data = trackData;
    this.spline = trackData.spline;
    this.totalLength = trackData.totalLength;
    this.envType = trackData.envType;

    if (this.data.mapLayout === 'OVAL') {
      this.roadWidth = 24.0;
      this.shoulderWidth = 3.5;
    } else {
      this.roadWidth = 14.0;
      this.shoulderWidth = 2.4;
    }

    this.checkpoints = [];
    this.roadMesh = null;
    this.shoulderMesh = null;
    this.terrainMesh = null;
    this.sceneryGroup = new THREE.Group();
    this.obstacles = [];

    this.initEnvironmentTheme();
    this.buildRoadMesh();
    this.buildFinishLine();
    this.buildPitLane();
    if (this.data.mapLayout !== 'OVAL') {
      this.buildCenterMountain();
    }
    this.buildRoadsideScenery();
    this.buildObstacles();

    // ----------------------------------------------------
    // PROCEDURAL CLOUD SYSTEM INSTANTIATION
    // ----------------------------------------------------
    const isOval = this.data.mapLayout === 'OVAL';
    let cloudColor = 0xffffff;
    let cloudOpacity = 0.45;

    if (this.data.envType === 'DESERT') {
      cloudColor = 0xffe9d2;
      cloudOpacity = 0.42;
    } else if (this.data.envType === 'NIGHT') {
      cloudColor = 0x4d5577;
      cloudOpacity = 0.32;
    } else if (this.data.envType === 'MOUNTAIN') {
      cloudColor = 0xedf2f7;
      cloudOpacity = 0.48;
    }

    const cloudFactory = window.ATR.createCloudSystem;
    if (typeof cloudFactory === 'function') {
      this.clouds = cloudFactory({
        count: isOval ? 48 : 36,
        baseAlt: 175,
        minRadius: 50,
        maxRadius: isOval ? 1150 : 690,
        boundX: isOval ? 1300 : 850,
        cloudColor: cloudColor,
        opacity: cloudOpacity,
        getHeightAt: (x, z) => {
          if (this.data.mapLayout === 'OVAL') return 10;
          const dist = Math.hypot(x, z);
          if (dist < 105) {
            return (1.0 - dist / 105) * 115;
          }
          return 0;
        }
      });

      this.sceneryGroup.add(this.clouds.group);
    }

    this.scene.add(this.sceneryGroup);
  }

  initEnvironmentTheme() {
    this.theme = {
      skyColor: 0x5c94fc,
      fogColor: 0x88b0e8,
      fogNear: 150,
      fogFar: 900,
      groundColor: 0x346b2b,
      treeLeaves: [0x235c39, 0x1b4332, 0x2d6a4f]
    };

    switch (this.data.envType) {
      case 'TROPICAL':
        this.theme.skyColor = 0x22a6b3;
        this.theme.fogColor = 0x7ed6df;
        this.theme.groundColor = 0x27ae60;
        this.theme.treeLeaves = [0x2ecc71, 0x1abc9c, 0x10ac84];
        this.theme.fogNear = 140;
        this.theme.fogFar = 860;
        break;
      case 'DESERT':
        this.theme.skyColor = 0xf4a261;
        this.theme.fogColor = 0xe9c46a;
        this.theme.groundColor = 0xd4a373;
        this.theme.treeLeaves = [0x936639, 0x7f4f24, 0x582f0e];
        break;
      case 'MOUNTAIN':
        this.theme.skyColor = 0x506b88;
        this.theme.fogColor = 0x6e859b;
        this.theme.groundColor = 0x475569;
        this.theme.treeLeaves = [0x1e3a2f, 0x2d4a3e];
        break;
      case 'SNOW':
        this.theme.skyColor = 0xb0c4de;
        this.theme.fogColor = 0xdde5ed;
        this.theme.groundColor = 0xe2e8f0;
        this.theme.treeLeaves = [0xffffff, 0xcfd8dc];
        break;
      case 'NIGHT':
        this.theme.skyColor = 0x050711;
        this.theme.fogColor = 0x0c1020;
        this.theme.groundColor = 0x0b1320;
        this.theme.fogNear = 80;
        this.theme.fogFar = 600;
        break;
    }

    if (this.data.mapLayout === 'OVAL') {
      this.theme.fogNear = 280;
      this.theme.fogFar = 1600;
    }

    this.scene.background = new THREE.Color(this.theme.skyColor);
    this.scene.fog = new THREE.Fog(this.theme.fogColor, this.theme.fogNear, this.theme.fogFar);
  }

  buildRoadMesh() {
    const samples = (this.data.mapLayout === 'OVAL') ? 1600 : 1200;
    const roadHalfWidth = this.roadWidth * 0.5;
    const shoulderWidth = this.shoulderWidth;

    const roadPositions = [];
    const roadUvs = [];
    const shoulderPositions = [];
    const shoulderColors = [];

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const roadInfo = this.getRoadTransformAt(t);
      const point = roadInfo.center;
      const normal = roadInfo.normal;
      const tangent = roadInfo.tangent;
      const roadUp = new THREE.Vector3().crossVectors(normal, tangent).normalize();

      if (i % 50 === 0) {
        this.checkpoints.push({
          index: this.checkpoints.length,
          t: t,
          point: point.clone()
        });
      }

      const leftEdge = point.clone().addScaledVector(normal, -roadHalfWidth).addScaledVector(roadUp, 0.08);
      const rightEdge = point.clone().addScaledVector(normal, roadHalfWidth).addScaledVector(roadUp, 0.08);

      roadPositions.push(leftEdge.x, leftEdge.y, leftEdge.z);
      roadPositions.push(rightEdge.x, rightEdge.y, rightEdge.z);

      roadUvs.push(0, i * 0.5);
      roadUvs.push(1, i * 0.5);

      const shoulderLeftOuter = point.clone().addScaledVector(normal, -(roadHalfWidth + shoulderWidth)).addScaledVector(roadUp, 0.06);
      const shoulderRightOuter = point.clone().addScaledVector(normal, (roadHalfWidth + shoulderWidth)).addScaledVector(roadUp, 0.06);

      shoulderPositions.push(shoulderLeftOuter.x, shoulderLeftOuter.y, shoulderLeftOuter.z);
      shoulderPositions.push(leftEdge.x, leftEdge.y, leftEdge.z);

      shoulderPositions.push(rightEdge.x, rightEdge.y, rightEdge.z);
      shoulderPositions.push(shoulderRightOuter.x, shoulderRightOuter.y, shoulderRightOuter.z);

      const isRed = (Math.floor(i / 2) % 2 === 0);
      const r = isRed ? 0.95 : 0.95;
      const g = isRed ? 0.1 : 0.95;
      const b = isRed ? 0.15 : 0.95;

      for (let c = 0; c < 4; c++) {
        shoulderColors.push(r, g, b);
      }
    }

    const roadIndices = [];
    for (let i = 0; i < samples; i++) {
      const idx = i * 2;
      roadIndices.push(idx, idx + 1, idx + 2);
      roadIndices.push(idx + 1, idx + 3, idx + 2);
    }

    const shoulderIndices = [];
    for (let i = 0; i < samples; i++) {
      const idx = i * 4;
      shoulderIndices.push(idx, idx + 1, idx + 4);
      shoulderIndices.push(idx + 1, idx + 5, idx + 4);
      shoulderIndices.push(idx + 2, idx + 3, idx + 6);
      shoulderIndices.push(idx + 3, idx + 7, idx + 6);
    }

    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
    roadGeo.setIndex(roadIndices);
    roadGeo.computeVertexNormals();

    const roadTex = this.createRoadTexture();
    roadTex.wrapS = THREE.RepeatWrapping;
    roadTex.wrapT = THREE.RepeatWrapping;
    roadTex.repeat.set(1, 45);

    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      roughness: 0.8,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    this.roadMesh = new THREE.Mesh(roadGeo, roadMat);
    this.scene.add(this.roadMesh);

    const shoulderGeo = new THREE.BufferGeometry();
    shoulderGeo.setAttribute('position', new THREE.Float32BufferAttribute(shoulderPositions, 3));
    shoulderGeo.setAttribute('color', new THREE.Float32BufferAttribute(shoulderColors, 3));
    shoulderGeo.setIndex(shoulderIndices);
    shoulderGeo.computeVertexNormals();

    const shoulderMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.shoulderMesh = new THREE.Mesh(shoulderGeo, shoulderMat);
    this.scene.add(this.shoulderMesh);

    this.buildTerrainPlane();
  }

  createRoadTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#222328';
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#1a1b1e' : '#2b2d33';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }

    ctx.fillStyle = '#ffffff';
    for (let y = 30; y < 512; y += 100) {
      ctx.fillRect(248, y, 16, 50);
    }

    ctx.fillStyle = '#eedd44';
    ctx.fillRect(12, 0, 10, 512);
    ctx.fillRect(490, 0, 10, 512);

    return new THREE.CanvasTexture(canvas);
  }

  buildTerrainPlane() {
    const size = this.data.mapLayout === 'OVAL' ? 4800 : 3500;
    const geo = new THREE.PlaneGeometry(size, size, 48, 48);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.MeshStandardMaterial({
      color: this.theme.groundColor,
      roughness: 0.9,
      flatShading: true,
      side: THREE.DoubleSide
    });
    this.terrainMesh = new THREE.Mesh(geo, mat);
    this.terrainMesh.position.y = -0.5;
    this.scene.add(this.terrainMesh);
  }

  buildCenterMountain() {
    const mountainGroup = new THREE.Group();
    const peakGeo = new THREE.ConeGeometry(95, 110, 9, 3);
    const peakMat = new THREE.MeshStandardMaterial({
      color: this.theme.groundColor,
      roughness: 0.95,
      flatShading: true
    });
    const peak = new THREE.Mesh(peakGeo, peakMat);
    peak.position.set(0, 52, 0);

    const capGeo = new THREE.ConeGeometry(38, 42, 9);
    const capMat = new THREE.MeshStandardMaterial({
      color: (this.data.envType === 'SNOW' || this.data.envType === 'MOUNTAIN') ? 0xffffff : 0x736961,
      roughness: 0.8,
      flatShading: true
    });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(0, 88, 0);

    const subPeakGeo = new THREE.ConeGeometry(65, 75, 7);
    const subPeak1 = new THREE.Mesh(subPeakGeo, peakMat);
    subPeak1.position.set(50, 36, -30);
    const subPeak2 = new THREE.Mesh(subPeakGeo, peakMat);
    subPeak2.position.set(-45, 32, 40);

    mountainGroup.add(peak, cap, subPeak1, subPeak2);
    this.sceneryGroup.add(mountainGroup);
  }

  buildFinishLine() {
    const bannerGroup = new THREE.Group();
    const startInfo = this.getRoadTransformAt(0.01);
    const startPoint = startInfo.center;
    const tangent = startInfo.tangent;
    const normal = startInfo.normal;
    const roadUp = new THREE.Vector3().crossVectors(normal, tangent).normalize();

    const postOffset = (this.roadWidth * 0.5) + 2.5;
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8, 0.8), pillarMat);
    const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8, 0.8), pillarMat);
    p1.position.copy(startPoint).addScaledVector(normal, -postOffset).addScaledVector(roadUp, 4);
    p2.position.copy(startPoint).addScaledVector(normal, postOffset).addScaledVector(roadUp, 4);

    const bannerCanvas = document.createElement('canvas');
    bannerCanvas.width = 256;
    bannerCanvas.height = 64;
    const ctx = bannerCanvas.getContext('2d');
    ctx.fillStyle = '#ff0055';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FINISH / START', 128, 42);

    const bannerTex = new THREE.CanvasTexture(bannerCanvas);
    const bannerMesh = new THREE.Mesh(
      new THREE.BoxGeometry(this.roadWidth + 5.0, 2.5, 0.5),
      new THREE.MeshBasicMaterial({ map: bannerTex })
    );
    bannerMesh.position.copy(startPoint).addScaledVector(roadUp, 7.5);
    bannerMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);

    bannerGroup.add(p1, p2, bannerMesh);
    this.sceneryGroup.add(bannerGroup);
  }

  buildPitLane() {
    const pitGroup = new THREE.Group();

    const signT = 0.026;
    const signInfo = this.getRoadTransformAt(signT);
    const signOffset = (this.roadWidth * 0.5) + 2.5;

    const pitSignGroup = this.createPitTrafficSign();
    pitSignGroup.position.copy(signInfo.center).addScaledVector(signInfo.normal, signOffset);
    pitSignGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), signInfo.tangent.clone().negate());
    pitGroup.add(pitSignGroup);

    const pitInfo = this.getRoadTransformAt(0.052);
    const pitPoint = pitInfo.center;
    const tangent = pitInfo.tangent;
    const normal = pitInfo.normal;
    const roadUp = new THREE.Vector3().crossVectors(normal, tangent).normalize();

    const buildingOffset = (this.roadWidth * 0.5) + 7.5;
    const canopyOffset = (this.roadWidth * 0.5) + 4.5;
    const apronOffset = (this.roadWidth * 0.5) + 3.5;
    const coneOffset = (this.roadWidth * 0.5) + 0.8;

    const pitBuilding = new THREE.Mesh(
      new THREE.BoxGeometry(6, 4.5, 28),
      new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.7 })
    );
    pitBuilding.position.copy(pitPoint).addScaledVector(normal, buildingOffset).addScaledVector(roadUp, 2.25);
    pitBuilding.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
    pitGroup.add(pitBuilding);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.4, 29),
      new THREE.MeshStandardMaterial({ color: 0xffee00, roughness: 0.5 })
    );
    roof.position.copy(pitPoint).addScaledVector(normal, canopyOffset).addScaledVector(roadUp, 4.5);
    roof.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
    pitGroup.add(roof);

    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 32),
      new THREE.MeshBasicMaterial({ color: 0x18181b, side: THREE.DoubleSide })
    );
    apron.position.copy(pitPoint).addScaledVector(normal, apronOffset).addScaledVector(roadUp, 0.07);
    apron.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
    apron.rotateX(-Math.PI / 2);
    pitGroup.add(apron);

    for (let c = -3; c <= 3; c++) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.35, 1.0, 6),
        new THREE.MeshBasicMaterial({ color: 0xff4400 })
      );
      cone.position.copy(pitPoint).addScaledVector(normal, coneOffset).addScaledVector(tangent, c * 5).addScaledVector(roadUp, 0.5);
      pitGroup.add(cone);
    }

    this.sceneryGroup.add(pitGroup);

    this.pitZone = {
      tStart: 0.024,
      tEnd: 0.082,
      center: pitPoint.clone().addScaledVector(normal, apronOffset)
    };
  }

  createPitTrafficSign() {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.2), new THREE.MeshBasicMaterial({ color: 0xcccccc }));
    pole.position.y = 2.1;

    const boardCanvas = document.createElement('canvas');
    boardCanvas.width = 128;
    boardCanvas.height = 64;
    const ctx = boardCanvas.getContext('2d');

    ctx.fillStyle = '#0066cc';
    ctx.fillRect(0, 0, 128, 64);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 124, 60);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PIT STOP', 64, 27);

    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = '#ffee00';
    ctx.fillText('➔ ➔', 64, 52);

    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 1.6),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(boardCanvas), side: THREE.DoubleSide })
    );
    board.position.y = 3.2;

    group.add(pole, board);
    return group;
  }

  buildRoadsideScenery() {
    const isOval = (this.data.mapLayout === 'OVAL');
    const numObjects = isOval ? 220 : 180;

    for (let i = 0; i < numObjects; i++) {
      const t = (i / numObjects + 0.02) % 1.0;

      const side = (i % 2 === 0) ? 1 : -1;
      if (side === 1 && t > 0.02 && t < 0.09) continue;

      const roadInfo = this.getRoadTransformAt(t);
      const point = roadInfo.center;
      const tangent = roadInfo.tangent;
      const normal = roadInfo.normal;
      const roadUp = new THREE.Vector3().crossVectors(normal, tangent).normalize();

      const baseDist = (this.roadWidth * 0.5) + (isOval ? 8 : 4);
      let distFromRoad = baseDist + (i % 5) * 6;

      if (isOval && side === 1) {
        distFromRoad = (this.roadWidth * 0.5) + this.shoulderWidth;
      }

      const objPos = point.clone().addScaledVector(normal, side * distFromRoad);
      if (isOval && side === 1) {
        objPos.addScaledVector(roadUp, 0.06);
      }

      if (i % 3 === 0) {
        let plant;
        if (this.data.envType === 'TROPICAL') {
          plant = this.createPalmTreeMesh();
        } else if (this.data.envType === 'DESERT') {
          plant = this.createCactusMesh();
        } else if (this.data.envType === 'SNOW') {
          plant = this.createSnowyPineMesh();
        } else {
          plant = this.createTreeMesh();
        }

        // Ground level (y = 0) on regular circuits, track level on oval
        const plantY = isOval ? objPos.y : 0;
        plant.position.set(objPos.x, plantY, objPos.z);
        this.sceneryGroup.add(plant);

      } else if (i % 3 === 1) {
        const isBigBoulder = (i % 6 === 1);
        const rock = this.createRockMesh(isBigBoulder);

        // Ground level on regular circuits, track level on oval
        const rockY = isOval
          ? (side === 1 ? objPos.y + (isBigBoulder ? 0.6 : 0.2) : objPos.y + (isBigBoulder ? 1.4 : 0.4))
          : (isBigBoulder ? 1.2 : 0.4);

        rock.position.set(objPos.x, rockY, objPos.z);
        this.sceneryGroup.add(rock);

      } else {
        const sign = this.createSignMesh(side > 0 ? 'RIGHT' : 'LEFT');

        if (isOval) {
          // Untouched track-level placement on oval
          sign.position.copy(point).addScaledVector(normal, side * ((this.roadWidth * 0.5) + 2.0)).addScaledVector(roadUp, 0.2);
          sign.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent.clone().negate());
        } else {
          // Ground level (y = 0) placement on all other maps
          const signPos = point.clone().addScaledVector(normal, side * ((this.roadWidth * 0.5) + 2.0));
          signPos.y = 0;
          sign.position.copy(signPos);
          const forward = new THREE.Vector3(-tangent.x, 0, -tangent.z).normalize();
          sign.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward);
        }

        this.sceneryGroup.add(sign);
      }
    }
  }

  createPalmTreeMesh() {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a4b26, roughness: 0.9, flatShading: true });
    const leafMat1 = new THREE.MeshStandardMaterial({ color: 0x1f9947, roughness: 0.8, flatShading: true, side: THREE.DoubleSide });
    const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x27ae60, roughness: 0.8, flatShading: true, side: THREE.DoubleSide });
    const nutMat = new THREE.MeshStandardMaterial({ color: 0x4e3019, roughness: 0.9, flatShading: true });

    const segments = 5;
    let prevHeight = 0;
    const trunkLean = (Math.random() - 0.5) * 0.14;

    for (let s = 0; s < segments; s++) {
      const segH = 1.3;
      const bottomR = 0.42 - s * 0.04;
      const topR = 0.38 - s * 0.04;
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(topR, bottomR, segH, 6), trunkMat);
      seg.position.set(s * trunkLean * 2.0, prevHeight + segH * 0.5, 0);
      seg.rotation.z = -trunkLean * (s + 1) * 0.4;
      group.add(seg);
      prevHeight += segH * 0.95;
    }

    const topX = (segments - 1) * trunkLean * 2.0;
    const topY = prevHeight + 0.2;

    for (let c = 0; c < 3; c++) {
      const angle = (c / 3) * Math.PI * 2;
      const nut = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), nutMat);
      nut.position.set(topX + Math.sin(angle) * 0.35, topY - 0.2, Math.cos(angle) * 0.35);
      group.add(nut);
    }

    const numFronds = 7;
    for (let f = 0; f < numFronds; f++) {
      const frondAngle = (f / numFronds) * Math.PI * 2 + Math.random() * 0.2;
      const frondGroup = new THREE.Group();

      const leafGeo = new THREE.ConeGeometry(0.85, 3.8, 4);
      leafGeo.rotateZ(Math.PI / 2);
      const leaf = new THREE.Mesh(leafGeo, f % 2 === 0 ? leafMat1 : leafMat2);
      leaf.position.x = 1.8;
      leaf.scale.set(1.0, 0.12, 1.0);

      frondGroup.add(leaf);
      frondGroup.position.set(topX, topY, 0);
      frondGroup.rotation.y = frondAngle;
      frondGroup.rotation.z = 0.42 + (f % 2) * 0.18;

      group.add(frondGroup);
    }

    const scale = 0.85 + Math.random() * 0.4;
    group.scale.set(scale, scale, scale);
    return group;
  }

  createTreeMesh() {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.9 });
    const leavesColor = this.theme.treeLeaves[Math.floor(Math.random() * this.theme.treeLeaves.length)];
    const leavesMat = new THREE.MeshStandardMaterial({ color: leavesColor, roughness: 0.8, flatShading: true });

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 3, 5), trunkMat);
    trunk.position.y = 1.5;
    group.add(trunk);

    for (let i = 0; i < 3; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(2.4 - i * 0.5, 2.6, 5), leavesMat);
      cone.position.y = 3.2 + i * 1.5;
      group.add(cone);
    }
    const scale = 0.8 + Math.random() * 0.6;
    group.scale.set(scale, scale, scale);
    return group;
  }

  createCactusMesh() {
    const group = new THREE.Group();
    const cactusMat = new THREE.MeshStandardMaterial({ color: 0x2e6f40, roughness: 0.85, flatShading: true });

    const height = 4.5 + Math.random() * 2.5;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, height, 7), cactusMat);
    trunk.position.y = height * 0.5;
    group.add(trunk);

    const armLHoriz = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.2, 6), cactusMat);
    armLHoriz.rotation.z = Math.PI / 2;
    armLHoriz.position.set(-0.6, height * 0.52, 0);
    const armLVert = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.4, 6), cactusMat);
    armLVert.position.set(-1.1, height * 0.52 + 0.6, 0);
    group.add(armLHoriz, armLVert);

    const armRHoriz = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.0, 6), cactusMat);
    armRHoriz.rotation.z = Math.PI / 2;
    armRHoriz.position.set(0.5, height * 0.65, 0);
    const armRVert = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.2, 6), cactusMat);
    armRVert.position.set(0.9, height * 0.65 + 0.5, 0);
    group.add(armRHoriz, armRVert);

    const scale = 0.8 + Math.random() * 0.4;
    group.scale.set(scale, scale, scale);
    return group;
  }

  createSnowyPineMesh() {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d271d, roughness: 0.9 });
    const needleMat = new THREE.MeshStandardMaterial({ color: 0x1a4329, roughness: 0.85, flatShading: true });
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xf5f8fc, roughness: 0.6, flatShading: true });

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 3.2, 5), trunkMat);
    trunk.position.y = 1.6;
    group.add(trunk);

    for (let i = 0; i < 4; i++) {
      const radius = 2.4 - i * 0.45;
      const height = 2.0;
      const needles = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 6), needleMat);
      needles.position.y = 2.8 + i * 1.35;

      const snowCap = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.72, height * 0.42, 6), snowMat);
      snowCap.position.y = 2.8 + i * 1.35 + 0.68;

      group.add(needles, snowCap);
    }

    const scale = 0.8 + Math.random() * 0.5;
    group.scale.set(scale, scale, scale);
    return group;
  }

  createRockMesh(isBig = false) {
    const radius = isBig ? (3.8 + Math.random() * 2.8) : (1.4 + Math.random() * 1.2);
    const geo = new THREE.DodecahedronGeometry(radius, 0);
    const rockColor = this.data.envType === 'DESERT' ? 0x9e6a45 : (this.data.envType === 'TROPICAL' ? 0x55606d : 0x777788);
    const mat = new THREE.MeshStandardMaterial({ color: rockColor, roughness: 0.9, flatShading: true });
    const rock = new THREE.Mesh(geo, mat);
    rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    return rock;
  }

  createSignMesh(direction = 'RIGHT') {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3), new THREE.MeshBasicMaterial({ color: 0xcccccc }));
    pole.position.y = 1.5;

    const boardCanvas = document.createElement('canvas');
    boardCanvas.width = 64;
    boardCanvas.height = 64;
    const ctx = boardCanvas.getContext('2d');
    ctx.fillStyle = '#ff0055';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(direction === 'RIGHT' ? '>>>' : '<<<', 32, 45);

    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 1.8),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(boardCanvas), side: THREE.DoubleSide })
    );
    board.position.y = 2.8;

    group.add(pole, board);
    return group;
  }

  createLogMesh(length = 6.8) {
    const group = new THREE.Group();
    const barkMat = new THREE.MeshStandardMaterial({ color: 0x3e2312, roughness: 0.9, flatShading: true });
    const endMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.7 });

    const radius = 0.46;
    const trunkGeo = new THREE.CylinderGeometry(radius, radius, length, 10);
    trunkGeo.rotateZ(Math.PI / 2);
    const trunk = new THREE.Mesh(trunkGeo, barkMat);
    group.add(trunk);

    const capGeo = new THREE.CircleGeometry(radius, 10);
    const capL = new THREE.Mesh(capGeo, endMat);
    capL.rotation.y = -Math.PI / 2;
    capL.position.x = -length * 0.5;

    const capR = new THREE.Mesh(capGeo, endMat);
    capR.rotation.y = Math.PI / 2;
    capR.position.x = length * 0.5;
    group.add(capL, capR);

    const branch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, 0.7, 5),
      barkMat
    );
    branch.position.set(length * 0.15, radius + 0.25, 0);
    branch.rotation.z = 0.35;
    group.add(branch);

    return group;
  }

  createRoadRockObstacle(width = 6.2) {
    const group = new THREE.Group();
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x696c73, roughness: 0.9, flatShading: true });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x484a50, roughness: 0.95, flatShading: true });

    const numRocks = 4;
    for (let i = 0; i < numRocks; i++) {
      const radius = 0.75 + Math.random() * 0.55;
      const rockGeo = new THREE.DodecahedronGeometry(radius, 0);
      const mesh = new THREE.Mesh(rockGeo, i % 2 === 0 ? rockMat : darkMat);

      const x = (i / (numRocks - 1) - 0.5) * (width * 0.72) + (Math.random() - 0.5) * 0.5;
      const z = (Math.random() - 0.5) * 0.7;
      mesh.position.set(x, radius * 0.7, z);
      mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      group.add(mesh);
    }
    return group;
  }

  buildObstacles() {
    if (this.data.mapLayout === 'OVAL') {
      return;
    }

    const minLogSpacingMeters = this.roadWidth * 2.4;
    const minSpacingT = minLogSpacingMeters / this.totalLength;

    let currentT = 0.13;
    let patternCounter = 0;

    while (currentT < 0.92) {
      patternCounter++;
      const patternType = patternCounter % 4;

      if (patternType === 1 || patternType === 3) {
        const firstSide = Math.random() > 0.5 ? -1 : 1;
        const secondSide = -firstSide;

        this.spawnHalfRoadObstacle('LOG', currentT, firstSide);

        const chicaneGapMeters = this.roadWidth * (2.2 + Math.random() * 0.8);
        currentT += chicaneGapMeters / this.totalLength;

        this.spawnHalfRoadObstacle('LOG', currentT, secondSide);
        currentT += minSpacingT + (Math.random() * 25) / this.totalLength;

      } else if (patternType === 2) {
        const side = Math.random() > 0.5 ? -1 : 1;
        this.spawnHalfRoadObstacle('ROCK', currentT, side);
        currentT += minSpacingT + (Math.random() * 20) / this.totalLength;

      } else {
        const tInfo = this.getRoadTransformAt(currentT);
        const laneOffsetRatio = (Math.random() * 1.0 - 0.5);
        const oilPos = tInfo.center.clone().addScaledVector(tInfo.normal, laneOffsetRatio * (this.roadWidth * 0.4));
        const roadUp = new THREE.Vector3().crossVectors(tInfo.normal, tInfo.tangent).normalize();

        const oilMesh = new THREE.Mesh(
          new THREE.CircleGeometry(2.0, 8),
          new THREE.MeshBasicMaterial({ color: 0x111115, opacity: 0.85, transparent: true, side: THREE.DoubleSide })
        );
        oilMesh.rotation.x = -Math.PI / 2;
        oilMesh.position.copy(oilPos).addScaledVector(roadUp, 0.08);

        this.sceneryGroup.add(oilMesh);
        this.obstacles.push({
          type: 'OIL',
          t: currentT,
          side: 0,
          position: oilPos,
          radius: 2.0
        });

        currentT += (this.roadWidth * 1.8) / this.totalLength;
      }
    }
  }

  spawnHalfRoadObstacle(type, t, side) {
    const tInfo = this.getRoadTransformAt(t);
    const halfRoadCenter = side * (this.roadWidth * 0.25);
    const obsPos = tInfo.center.clone().addScaledVector(tInfo.normal, halfRoadCenter);

    let mesh;
    if (type === 'LOG') {
      mesh = this.createLogMesh(this.roadWidth * 0.48);
    } else {
      mesh = this.createRoadRockObstacle(this.roadWidth * 0.46);
    }

    const roadUp = new THREE.Vector3().crossVectors(tInfo.normal, tInfo.tangent).normalize();
    const forward = tInfo.tangent.clone().negate();
    const basisMatrix = new THREE.Matrix4().makeBasis(tInfo.normal, roadUp, forward);

    mesh.quaternion.setFromRotationMatrix(basisMatrix);
    mesh.position.copy(obsPos).addScaledVector(roadUp, 0.25);

    this.sceneryGroup.add(mesh);
    this.obstacles.push({
      type,
      t,
      side,
      position: obsPos,
      radius: this.roadWidth * 0.26
    });
  }

  getRoadTransformAt(t) {
    const normalizedT = ((t % 1.0) + 1.0) % 1.0;
    const center = this.spline.getPointAt(normalizedT);
    const tangent = this.spline.getTangentAt(normalizedT).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

    let bankAngle = 0;

    // Banking is strictly applied to the NASCAR OVAL superspeedway
    if (this.data.mapLayout === 'OVAL') {
      const turnDeflection = Math.abs(tangent.x);
      const p = Math.min(1.0, Math.max(0.0, (turnDeflection - 0.04) / 0.66));
      const w = p * p * p * (p * (p * 6 - 15) + 10);
      const ovalBank = 0.21 + w * 0.38;
      bankAngle = -ovalBank;
    }

    if (Math.abs(bankAngle) > 0.005) {
      normal.applyAxisAngle(tangent, bankAngle);
    }

    return { center, tangent, normal, bankAngle, t: normalizedT };
  }
}

window.ATR.TrackGenerator = TrackGenerator;
window.ATR.Track = Track;
