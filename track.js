/* ===================================================
   AMIGA TURBO RACER - PROCEDURAL TRACK GENERATOR
   Creates dynamic 3D ribbon road geometry, Catmull-Rom
   spline elevation, turns, jumps, roadside signs,
   scenery (trees, rocks, logs, oil, water), and pit lane.
   =================================================== */

window.ATR = window.ATR || {};

class TrackGenerator {
  constructor() {
    this.roadWidth = 14;
    this.shoulderWidth = 2.4;
  }

  // Deterministic PRNG seeded random
  createPRNG(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function() {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  generate(seed = 849271, difficulty = 'MEDIUM', envType = 'FOREST', numWaypoints = 48) {
    const random = this.createPRNG(seed);
    const controlPoints = [];

    // Organic, guaranteed closed-loop Grand Prix circuit layout
    const radiusX = 220 + random() * 60;
    const radiusZ = 380 + random() * 80;
    const hillScale = difficulty === 'HARD' ? 14.0 : 8.0;

    for (let i = 0; i < numWaypoints; i++) {
      const angle = (i / numWaypoints) * Math.PI * 2;

      let rX = radiusX;
      let rZ = radiusZ;

      // Natural curves for chicanes and bends based on seed
      const bend1 = Math.sin(angle * 2) * 45 * (random() * 0.4 + 0.8);
      const bend2 = Math.cos(angle * 3) * 30 * (random() * 0.4 + 0.8);

      let x = Math.sin(angle) * (rX + bend1);
      let z = -Math.cos(angle) * (rZ + bend2);

      // Dedicated flat main straight for starting grid and pits around angle = 0
      const straightFactor = Math.exp(-Math.pow(angle < Math.PI ? angle : angle - Math.PI * 2, 2) / 0.08);
      x = x * (1 - straightFactor);

      // Elevation profile (hills, crests, dips)
      let y = Math.sin(angle * 3) * hillScale + Math.cos(angle * 5) * (hillScale * 0.5);
      y = Math.max(0, y * (1 - straightFactor));

      controlPoints.push(new THREE.Vector3(x, y, z));
    }

    // Build smooth, closed Catmull-Rom Spline Curve
    const spline = new THREE.CatmullRomCurve3(controlPoints, true, 'catmullrom');

    return {
      controlPoints,
      spline,
      totalLength: spline.getLength(),
      seed,
      envType
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
    this.roadWidth = 14;

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
    this.buildRoadsideScenery();
    this.buildObstacles();

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

    this.scene.background = new THREE.Color(this.theme.skyColor);
    this.scene.fog = new THREE.Fog(this.theme.fogColor, this.theme.fogNear, this.theme.fogFar);
  }

  // Generate 3D Ribbon Road Geometry
  buildRoadMesh() {
    const samples = 1000;
    const roadHalfWidth = this.roadWidth * 0.5;
    const shoulderWidth = 2.4;

    const roadPositions = [];
    const roadUvs = [];
    const shoulderPositions = [];
    const shoulderColors = [];

    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const point = this.spline.getPointAt(t);
      const tangent = this.spline.getTangentAt(t).normalize();
      // tangent x up points Right relative to driving direction
      const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      // Checkpoint recording
      if (i % 50 === 0) {
        this.checkpoints.push({
          index: this.checkpoints.length,
          t: t,
          point: point.clone()
        });
      }

      // Road Surface vertices (- is left, + is right)
      const leftEdge = point.clone().addScaledVector(normal, -roadHalfWidth);
      const rightEdge = point.clone().addScaledVector(normal, roadHalfWidth);

      roadPositions.push(leftEdge.x, leftEdge.y + 0.08, leftEdge.z);
      roadPositions.push(rightEdge.x, rightEdge.y + 0.08, rightEdge.z);

      roadUvs.push(0, i * 0.5);
      roadUvs.push(1, i * 0.5);

      // Shoulders (red and white arcade curbs)
      const shoulderLeftOuter = point.clone().addScaledVector(normal, -(roadHalfWidth + shoulderWidth));
      const shoulderRightOuter = point.clone().addScaledVector(normal, (roadHalfWidth + shoulderWidth));

      shoulderPositions.push(shoulderLeftOuter.x, shoulderLeftOuter.y + 0.06, shoulderLeftOuter.z);
      shoulderPositions.push(leftEdge.x, leftEdge.y + 0.06, leftEdge.z);

      shoulderPositions.push(rightEdge.x, rightEdge.y + 0.06, rightEdge.z);
      shoulderPositions.push(shoulderRightOuter.x, shoulderRightOuter.y + 0.06, shoulderRightOuter.z);

      const isRed = (Math.floor(i / 2) % 2 === 0);
      const r = isRed ? 0.95 : 0.95;
      const g = isRed ? 0.1 : 0.95;
      const b = isRed ? 0.15 : 0.95;

      for (let c = 0; c < 4; c++) {
        shoulderColors.push(r, g, b);
      }
    }

    // Road Indices
    const roadIndices = [];
    for (let i = 0; i < samples; i++) {
      const idx = i * 2;
      roadIndices.push(idx, idx + 1, idx + 2);
      roadIndices.push(idx + 1, idx + 3, idx + 2);
    }

    // Shoulder Indices
    const shoulderIndices = [];
    for (let i = 0; i < samples; i++) {
      const idx = i * 4;
      // Left shoulder
      shoulderIndices.push(idx, idx + 1, idx + 4);
      shoulderIndices.push(idx + 1, idx + 5, idx + 4);
      // Right shoulder
      shoulderIndices.push(idx + 2, idx + 3, idx + 6);
      shoulderIndices.push(idx + 3, idx + 7, idx + 6);
    }

    // Build Road BufferGeometry
    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
    roadGeo.setIndex(roadIndices);
    roadGeo.computeVertexNormals();

    const roadTex = this.createRoadTexture();
    roadTex.wrapS = THREE.RepeatWrapping;
    roadTex.wrapT = THREE.RepeatWrapping;
    roadTex.repeat.set(1, 40);

    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      roughness: 0.8,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    this.roadMesh = new THREE.Mesh(roadGeo, roadMat);
    this.scene.add(this.roadMesh);

    // Build Shoulder BufferGeometry
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

    // Dark asphalt base
    ctx.fillStyle = '#222328';
    ctx.fillRect(0, 0, 512, 512);

    // Asphalt noise grain
    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#1a1b1e' : '#2b2d33';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }

    // White dashed center line
    ctx.fillStyle = '#ffffff';
    for (let y = 30; y < 512; y += 100) {
      ctx.fillRect(248, y, 16, 50);
    }

    // Edge lines
    ctx.fillStyle = '#eedd44';
    ctx.fillRect(12, 0, 10, 512);
    ctx.fillRect(490, 0, 10, 512);

    return new THREE.CanvasTexture(canvas);
  }

  buildTerrainPlane() {
    const geo = new THREE.PlaneGeometry(3500, 3500, 48, 48);
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

  buildFinishLine() {
    const bannerGroup = new THREE.Group();
    const startPoint = this.spline.getPointAt(0.01);
    const tangent = this.spline.getTangentAt(0.01).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

    // Arch pillars
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8, 0.8), pillarMat);
    const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8, 0.8), pillarMat);
    p1.position.copy(startPoint).addScaledVector(normal, -9.5).setY(4);
    p2.position.copy(startPoint).addScaledVector(normal, 9.5).setY(4);

    // Banner
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
      new THREE.BoxGeometry(19, 2.5, 0.5),
      new THREE.MeshBasicMaterial({ map: bannerTex })
    );
    bannerMesh.position.copy(startPoint).setY(7.5);
    bannerMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);

    bannerGroup.add(p1, p2, bannerMesh);
    this.sceneryGroup.add(bannerGroup);
  }

  buildPitLane() {
    const pitPoint = this.spline.getPointAt(0.06);
    const tangent = this.spline.getTangentAt(0.06).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

    const pitBuilding = new THREE.Mesh(
      new THREE.BoxGeometry(5, 5, 30),
      new THREE.MeshStandardMaterial({ color: 0x334466 })
    );
    pitBuilding.position.copy(pitPoint).addScaledVector(normal, 14).setY(2.5);
    pitBuilding.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);

    this.sceneryGroup.add(pitBuilding);
    this.pitZone = {
      tStart: 0.04,
      tEnd: 0.08,
      center: pitPoint.clone().addScaledVector(normal, 8)
    };
  }

  buildRoadsideScenery() {
    const numObjects = 180;
    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < numObjects; i++) {
      const t = (i / numObjects + 0.02) % 1.0;
      const point = this.spline.getPointAt(t);
      const tangent = this.spline.getTangentAt(t).normalize();
      const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      const side = (i % 2 === 0) ? 1 : -1;
      const distFromRoad = 11 + (i % 5) * 6;
      const objPos = point.clone().addScaledVector(normal, side * distFromRoad);

      if (i % 3 === 0) {
        // Low-Poly Trees planted on ground
        const tree = this.createTreeMesh();
        tree.position.set(objPos.x, 0, objPos.z);
        this.sceneryGroup.add(tree);
      } else if (i % 3 === 1) {
        // Rocks embedded on ground
        const rock = this.createRockMesh();
        rock.position.set(objPos.x, 0.4, objPos.z);
        this.sceneryGroup.add(rock);
      } else {
        // Chevron Warning Signs (remain aligned with elevated road shoulders)
        const sign = this.createSignMesh(side > 0 ? 'RIGHT' : 'LEFT');
        sign.position.copy(point).addScaledVector(normal, side * 8.8);
        sign.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent.clone().negate());
        this.sceneryGroup.add(sign);
      }
    }
  }

  createTreeMesh() {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.9 });
    const leavesColor = this.theme.treeLeaves[Math.floor(Math.random() * this.theme.treeLeaves.length)];
    const leavesMat = new THREE.MeshStandardMaterial({ color: leavesColor, roughness: 0.8, flatShading: true });

    // Trunk
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 3, 5), trunkMat);
    trunk.position.y = 1.5;
    group.add(trunk);

    // Foliage
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(2.4 - i * 0.5, 2.6, 5), leavesMat);
      cone.position.y = 3.2 + i * 1.5;
      group.add(cone);
    }
    const scale = 0.8 + Math.random() * 0.6;
    group.scale.set(scale, scale, scale);
    return group;
  }

  createRockMesh() {
    const geo = new THREE.IcosahedronGeometry(1.4 + Math.random() * 1.2, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x777788, roughness: 0.8, flatShading: true });
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
    ctx.fillStyle = '#ff0044';
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

    const trunkGeo = new THREE.CylinderGeometry(0.44, 0.5, length, 8);
    trunkGeo.rotateZ(Math.PI / 2); // Aligns along local X (road normal)
    const trunk = new THREE.Mesh(trunkGeo, barkMat);
    group.add(trunk);

    // End cuts
    const capGeo = new THREE.CircleGeometry(0.44, 8);
    const capL = new THREE.Mesh(capGeo, endMat);
    capL.rotation.y = -Math.PI / 2;
    capL.position.x = -length * 0.5;

    const capR = new THREE.Mesh(capGeo, endMat);
    capR.rotation.y = Math.PI / 2;
    capR.position.x = length * 0.5;
    group.add(capL, capR);

    // Branch nub
    const branch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.18, 0.8, 5),
      barkMat
    );
    branch.position.set(length * 0.15, 0.45, 0.15);
    branch.rotation.z = 0.4;
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
    const minLogSpacingMeters = this.roadWidth * 2.4; // Exceeds 2 track widths (>= 33.6m)
    const minSpacingT = minLogSpacingMeters / this.totalLength;

    let currentT = 0.13;
    let patternCounter = 0;

    while (currentT < 0.92) {
      patternCounter++;
      const patternType = patternCounter % 4;

      if (patternType === 1 || patternType === 3) {
        // SLALOM / CHICANE: First log on one side, second on opposite side after >= 2 track widths
        const firstSide = Math.random() > 0.5 ? -1 : 1;
        const secondSide = -firstSide;

        // Place first log
        this.spawnHalfRoadObstacle('LOG', currentT, firstSide);

        // Advance by at least 2 full track widths before the second log
        const chicaneGapMeters = this.roadWidth * (2.2 + Math.random() * 0.8); // 30.8m - 42m
        currentT += chicaneGapMeters / this.totalLength;

        // Place second log on the opposite side (forcing slalom)
        this.spawnHalfRoadObstacle('LOG', currentT, secondSide);

        // Advance by at least 2 track widths before next hazard
        currentT += minSpacingT + (Math.random() * 25) / this.totalLength;

      } else if (patternType === 2) {
        // HALF-ROAD STONE CLUSTER
        const side = Math.random() > 0.5 ? -1 : 1;
        this.spawnHalfRoadObstacle('ROCK', currentT, side);
        currentT += minSpacingT + (Math.random() * 20) / this.totalLength;

      } else {
        // OIL SLICK HAZARD
        const tInfo = this.getRoadTransformAt(currentT);
        const laneOffsetRatio = (Math.random() * 1.0 - 0.5);
        const oilPos = tInfo.center.clone().addScaledVector(tInfo.normal, laneOffsetRatio * (this.roadWidth * 0.4));

        const oilMesh = new THREE.Mesh(
          new THREE.CircleGeometry(2.0, 8),
          new THREE.MeshBasicMaterial({ color: 0x111115, opacity: 0.85, transparent: true, side: THREE.DoubleSide })
        );
        oilMesh.rotation.x = -Math.PI / 2;
        oilMesh.position.copy(oilPos).setY(oilPos.y + 0.08);

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
    const up = new THREE.Vector3(0, 1, 0);
    const tInfo = this.getRoadTransformAt(t);

    // Center obstacle in either left (-3.5m) or right (+3.5m) half of the 14m road
    const halfRoadCenter = side * (this.roadWidth * 0.25);
    const obsPos = tInfo.center.clone().addScaledVector(tInfo.normal, halfRoadCenter);

    let mesh;
    if (type === 'LOG') {
      mesh = this.createLogMesh(this.roadWidth * 0.48);
    } else {
      mesh = this.createRoadRockObstacle(this.roadWidth * 0.46);
    }

    // Orient geometry across the road ribbon
    const basisMatrix = new THREE.Matrix4().makeBasis(tInfo.normal, up, tInfo.tangent);
    mesh.quaternion.setFromRotationMatrix(basisMatrix);
    mesh.position.copy(obsPos);
    mesh.position.y += 0.25;

    this.sceneryGroup.add(mesh);
    this.obstacles.push({
      type,
      t,
      side,
      position: obsPos,
      radius: this.roadWidth * 0.26 // 3.6m radius strictly covers only that half of the road
    });
  }

  // Get Road Center, Tangent, and Normal at normalized distance t (0.0 to 1.0)
  getRoadTransformAt(t) {
    const normalizedT = ((t % 1.0) + 1.0) % 1.0;
    const center = this.spline.getPointAt(normalizedT);
    const tangent = this.spline.getTangentAt(normalizedT).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    // tangent x up points Right relative to driving direction
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

    return { center, tangent, normal, t: normalizedT };
  }
}

window.ATR.TrackGenerator = TrackGenerator;
window.ATR.Track = Track;
