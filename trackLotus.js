/* ===================================================
   AMIGA TURBO RACER - INFINITE LOTUS HIGHWAY
   Procedurally generates a never-ending ribbon highway
   inspired by Lotus Esprit Turbo Challenge. Features
   dynamic chunk generation, continuous biome transitions,
   retro billboards, telegraph poles, periodic pit oases,
   alternating roadside hazards, and active memory disposal.
   =================================================== */

window.ATR = window.ATR || {};

class InfiniteLotusTrack {
  constructor(scene, trackData) {
    this.scene = scene;
    this.data = trackData;
    this.isInfinite = true;
    this.seed = trackData.seed || 849271;
    this.totalLength = 999999999;
    this.roadWidth = 16.0;
    this.shoulderWidth = 2.8;

    this.sceneryGroup = new THREE.Group();
    this.roadGroup = new THREE.Group();
    this.shoulderGroup = new THREE.Group();
    this.scene.add(this.roadGroup, this.shoulderGroup, this.sceneryGroup);

    this.checkpoints = [];
    this.obstacles = [];
    this.activeChunks = new Map(); // chunkIndex => chunkObject

    this.chunkLength = 75.0; // 75 meters per chunk
    this.waypointStep = 25.0;
    this.waypoints = [];
    this.furthestWaypointIndex = -1;

    this.prng = this.createPRNG(this.seed);
    this.currentHeading = 0.0;
    this.currentPos = new THREE.Vector3(0, 0, 0);
    this.currentCurvature = 0.0;
    this.targetCurvature = 0.0;
    this.sectionRemainingDist = 0;

    this.biomes = ['FOREST', 'DESERT', 'SNOW', 'TROPICAL', 'MIDNIGHT'];
    this.currentBiome = 'FOREST';
    this.theme = this.getBiomeTheme('FOREST');
    this.initEnvironmentTheme();

    this.billboardTextures = this.createBillboardTextures();
    this.roadTexture = this.createLotusRoadTexture();

    this.extendWaypointsUpTo(850.0);
    this.updateChunks(0);
    this.buildStartGantry();

    if (typeof window.ATR.createCloudSystem === 'function') {
      this.clouds = window.ATR.createCloudSystem({
        count: 36,
        baseAlt: 160,
        minRadius: 40,
        maxRadius: 750,
        boundX: 1000
      });
      this.sceneryGroup.add(this.clouds.group);
    }
  }

  createPRNG(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => (s = (s * 16807) % 2147483647, (s - 1) / 2147483646);
  }

  getBiomeTheme(biome) {
    const themes = {
      DESERT:   { skyColor: 0xf4a261, fogColor: 0xe9c46a, groundColor: 0xd4a373, fogNear: 160, fogFar: 950 },
      SNOW:     { skyColor: 0xb0c4de, fogColor: 0xdde5ed, groundColor: 0xe2e8f0, fogNear: 150, fogFar: 900 },
      TROPICAL: { skyColor: 0x22a6b3, fogColor: 0x7ed6df, groundColor: 0x27ae60, fogNear: 160, fogFar: 920 },
      MIDNIGHT: { skyColor: 0x050711, fogColor: 0x0d1224, groundColor: 0x090e18, fogNear: 90,  fogFar: 650 },
      FOREST:   { skyColor: 0x5c94fc, fogColor: 0x88b0e8, groundColor: 0x346b2b, fogNear: 180, fogFar: 1050 }
    };
    return themes[biome] || themes.FOREST;
  }

  initEnvironmentTheme() {
    this.scene.background = new THREE.Color(this.theme.skyColor);
    this.scene.fog = new THREE.Fog(this.theme.fogColor, this.theme.fogNear, this.theme.fogFar);
  }

  updateBiome(targetBiome) {
    if (this.currentBiome === targetBiome) return;
    this.currentBiome = targetBiome;
    this.theme = this.getBiomeTheme(targetBiome);
    this.scene.background.setHex(this.theme.skyColor);
    this.scene.fog.color.setHex(this.theme.fogColor);
    this.scene.fog.near = this.theme.fogNear;
    this.scene.fog.far = this.theme.fogFar;
  }

  createLotusRoadTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1c1e22';
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 3500; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#16171b' : '#26282e';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(16, 0, 12, 512);
    ctx.fillRect(484, 0, 12, 512);
    for (let y = 20; y < 512; y += 96) ctx.fillRect(250, y, 12, 54);

    ctx.fillStyle = '#eedd44';
    for (let y = 10; y < 512; y += 96) {
      ctx.fillRect(132, y, 6, 48);
      ctx.fillRect(374, y, 6, 48);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 10);
    return tex;
  }

  createBillboardTextures() {
    const cfgs = [
      { bg: '#004d26', title: 'LOTUS', sub: 'ESPRIT TURBO', border: '#ffe600' },
      { bg: '#002288', title: 'AMIGA', sub: 'TURBO 1200', border: '#ff0055' },
      { bg: '#550055', title: 'TURBO', sub: 'CHALLENGE', border: '#00ffff' },
      { bg: '#111827', title: 'COMMODORE', sub: 'POWER PLAY', border: '#ffffff' },
      { bg: '#882200', title: 'MAGNETIC', sub: 'FIELDS', border: '#ffe600' }
    ];
    return cfgs.map(c => {
      const cv = document.createElement('canvas');
      cv.width = 256; cv.height = 128;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, 256, 128);
      ctx.strokeStyle = c.border; ctx.lineWidth = 6; ctx.strokeRect(3, 3, 250, 122);
      ctx.fillStyle = c.border; ctx.font = '900 34px monospace'; ctx.textAlign = 'center';
      ctx.fillText(c.title, 128, 56);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 20px monospace';
      ctx.fillText(c.sub, 128, 98);
      return new THREE.CanvasTexture(cv);
    });
  }

  extendWaypointsUpTo(targetS) {
    while (this.furthestWaypointIndex < 0 || this.furthestWaypointIndex * this.waypointStep < targetS) {
      this.furthestWaypointIndex++;
      const s = this.furthestWaypointIndex * this.waypointStep;

      if (this.sectionRemainingDist <= 0) {
        const roll = this.prng();
        if (roll < 0.35) {
          this.targetCurvature = 0.0;
          this.sectionRemainingDist = 180 + this.prng() * 240;
        } else if (roll < 0.7) {
          const dir = this.prng() > 0.5 ? 1 : -1;
          this.targetCurvature = dir * (0.003 + this.prng() * 0.003);
          this.sectionRemainingDist = 140 + this.prng() * 180;
        } else {
          const dir = this.prng() > 0.5 ? 1 : -1;
          this.targetCurvature = dir * 0.006;
          this.sectionRemainingDist = 120 + this.prng() * 140;
        }
      }

      this.currentCurvature += (this.targetCurvature - this.currentCurvature) * 0.2;
      this.currentHeading += this.currentCurvature * this.waypointStep;
      this.sectionRemainingDist -= this.waypointStep;

      const startBlend = Math.min(1.0, s / 180.0);
      const elev = Math.max(0, (Math.sin(s * 0.007) * 14.0 + Math.sin(s * 0.016) * 6.5 + Math.cos(s * 0.003) * 18.0) * startBlend);

      if (this.furthestWaypointIndex === 0) {
        this.currentPos.set(0, 0, 0);
      } else {
        this.currentPos.x += Math.sin(this.currentHeading) * this.waypointStep;
        this.currentPos.z += -Math.cos(this.currentHeading) * this.waypointStep;
        this.currentPos.y = elev;
      }

      const tangent = new THREE.Vector3(Math.sin(this.currentHeading), 0, -Math.cos(this.currentHeading)).normalize();
      const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
      const bankAngle = Math.max(-0.25, Math.min(0.25, -this.currentCurvature * 26.0));
      normal.applyAxisAngle(tangent, bankAngle);

      this.waypoints.push({
        s,
        pos: this.currentPos.clone(),
        tangent,
        normal,
        bankAngle,
        curvature: this.currentCurvature
      });
    }
  }

  getRoadTransformAt(s) {
    if (s < 0) s = 0;
    this.extendWaypointsUpTo(s + 100);

    const firstS = this.waypoints[0].s;
    let idx = Math.floor((s - firstS) / this.waypointStep);
    if (idx < 0) idx = 0;
    if (idx >= this.waypoints.length - 1) idx = this.waypoints.length - 2;

    const w0 = this.waypoints[idx];
    const w1 = this.waypoints[idx + 1];
    const u = Math.max(0, Math.min(1, (s - w0.s) / (w1.s - w0.s)));

    const p0 = w0.pos, p1 = w1.pos;
    const m0 = w0.tangent.clone().multiplyScalar(this.waypointStep);
    const m1 = w1.tangent.clone().multiplyScalar(this.waypointStep);

    const u2 = u * u, u3 = u2 * u;
    const center = new THREE.Vector3()
      .addScaledVector(p0, 2 * u3 - 3 * u2 + 1)
      .addScaledVector(m0, u3 - 2 * u2 + u)
      .addScaledVector(p1, -2 * u3 + 3 * u2)
      .addScaledVector(m1, u3 - u2);

    const tangent = new THREE.Vector3()
      .addScaledVector(p0, 6 * u2 - 6 * u)
      .addScaledVector(m0, 3 * u2 - 4 * u + 1)
      .addScaledVector(p1, -6 * u2 + 6 * u)
      .addScaledVector(m1, 3 * u2 - 2 * u)
      .normalize();

    const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
    const bankAngle = THREE.MathUtils.lerp(w0.bankAngle, w1.bankAngle, u);
    normal.applyAxisAngle(tangent, bankAngle);

    return { center, tangent, normal, bankAngle, t: s };
  }

  update(playerCar, allCars, delta) {
    if (!playerCar) return;
    const playerS = playerCar.trackT || 0;

    this.extendWaypointsUpTo(playerS + 950);
    this.updateChunks(playerS);

    const stageIdx = Math.floor(playerS / 1500.0);
    this.updateBiome(this.biomes[stageIdx % this.biomes.length]);

    // Service bay / pit stop every 2000m
    const pitInterval = 2000.0;
    const nextPitS = Math.floor(playerS / pitInterval) * pitInterval + 1600.0;
    const pitInfo = this.getRoadTransformAt(nextPitS);
    this.pitZone = {
      center: pitInfo.center.clone().addScaledVector(pitInfo.normal, this.roadWidth * 0.5 + 4.0),
      distance: nextPitS
    };

    // AI CAR RECYCLING: respawn AI falling > 240m behind the player ahead
    if (allCars && allCars.length > 1) {
      for (let car of allCars) {
        if (car.isPlayer) continue;
        if (playerS - car.trackT > 240.0) {
          const respawnDist = playerS + 120.0 + Math.random() * 120.0;
          car.trackT = respawnDist;
          car.totalRaceDistance = respawnDist;
          car.laneOffset = (Math.random() - 0.5) * 1.5;
          car.speed = Math.max(80, playerCar.speed * (0.85 + Math.random() * 0.25));
          car.health = 100; car.fuel = 100; car.tires = 100;
          car.updatePhysics(0.001, this);
        }
      }
    }

    // Prune waypoints > 260m behind the player
    const minKeepS = playerS - 260.0;
    while (this.waypoints.length > 20 && this.waypoints[0].s < minKeepS) {
      this.waypoints.shift();
    }
  }

  updateChunks(playerS) {
    const minChunk = Math.floor((playerS - 180.0) / this.chunkLength);
    const maxChunk = Math.floor((playerS + 900.0) / this.chunkLength);

    // Dispose old chunks from GPU/RAM
    for (let [idx, chunk] of this.activeChunks.entries()) {
      if (idx < minChunk || idx > maxChunk + 3) {
        this.disposeChunk(chunk);
        this.activeChunks.delete(idx);
      }
    }

    // Spawn new chunks ahead
    for (let i = Math.max(0, minChunk); i <= maxChunk; i++) {
      if (!this.activeChunks.has(i)) {
        this.activeChunks.set(i, this.buildChunk(i));
      }
    }
  }

  buildChunk(chunkIndex) {
    const startS = chunkIndex * this.chunkLength;
    const endS = startS + this.chunkLength;
    const samples = 30;

    const roadPositions = [], roadUvs = [], shoulderPositions = [], shoulderColors = [], terrainPositions = [], terrainColors = [];
    const roadHalfWidth = this.roadWidth * 0.5;
    const shoulderWidth = this.shoulderWidth;
    const terrainWidth = 320.0;
    const chunkProps = [], chunkObstacles = [];

    const stageIdx = Math.floor(startS / 1500.0);
    const biome = this.biomes[stageIdx % this.biomes.length];
    const theme = this.getBiomeTheme(biome);

    for (let i = 0; i <= samples; i++) {
      const s = startS + (i / samples) * this.chunkLength;
      const info = this.getRoadTransformAt(s);
      const point = info.center, normal = info.normal, tangent = info.tangent;
      const roadUp = new THREE.Vector3().crossVectors(normal, tangent).normalize();

      const leftEdge = point.clone().addScaledVector(normal, -roadHalfWidth).addScaledVector(roadUp, 0.08);
      const rightEdge = point.clone().addScaledVector(normal, roadHalfWidth).addScaledVector(roadUp, 0.08);

      roadPositions.push(leftEdge.x, leftEdge.y, leftEdge.z, rightEdge.x, rightEdge.y, rightEdge.z);
      roadUvs.push(0, s * 0.15, 1, s * 0.15);

      const shL = point.clone().addScaledVector(normal, -(roadHalfWidth + shoulderWidth)).addScaledVector(roadUp, 0.06);
      const shR = point.clone().addScaledVector(normal, (roadHalfWidth + shoulderWidth)).addScaledVector(roadUp, 0.06);

      shoulderPositions.push(shL.x, shL.y, shL.z, leftEdge.x, leftEdge.y, leftEdge.z, rightEdge.x, rightEdge.y, rightEdge.z, shR.x, shR.y, shR.z);

      const isRed = Math.floor(s / 4.5) % 2 === 0;
      const cr = 0.95, cg = isRed ? 0.12 : 0.95, cb = isRed ? 0.16 : 0.95;
      for (let c = 0; c < 4; c++) shoulderColors.push(cr, cg, cb);

      const tL = shL.clone().addScaledVector(normal, -terrainWidth);
      const tR = shR.clone().addScaledVector(normal, terrainWidth);
      terrainPositions.push(tL.x, tL.y - 1.2, tL.z, shL.x, shL.y - 0.2, shL.z, shR.x, shR.y - 0.2, shR.z, tR.x, tR.y - 1.2, tR.z);

      const tc = new THREE.Color(theme.groundColor);
      for (let c = 0; c < 4; c++) terrainColors.push(tc.r, tc.g, tc.b);
    }

    const roadIndices = [], shoulderIndices = [], terrainIndices = [];
    for (let i = 0; i < samples; i++) {
      const rIdx = i * 2;
      roadIndices.push(rIdx, rIdx + 1, rIdx + 2, rIdx + 1, rIdx + 3, rIdx + 2);
      const sIdx = i * 4;
      shoulderIndices.push(sIdx, sIdx + 1, sIdx + 4, sIdx + 1, sIdx + 5, sIdx + 4, sIdx + 2, sIdx + 3, sIdx + 6, sIdx + 3, sIdx + 7, sIdx + 6);
      terrainIndices.push(sIdx, sIdx + 1, sIdx + 4, sIdx + 1, sIdx + 5, sIdx + 4, sIdx + 2, sIdx + 3, sIdx + 6, sIdx + 3, sIdx + 7, sIdx + 6);
    }

    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
    roadGeo.setIndex(roadIndices);
    roadGeo.computeVertexNormals();

    const roadMesh = new THREE.Mesh(roadGeo, new THREE.MeshStandardMaterial({ map: this.roadTexture, roughness: 0.85, side: THREE.DoubleSide }));
    this.roadGroup.add(roadMesh);

    const shoulderGeo = new THREE.BufferGeometry();
    shoulderGeo.setAttribute('position', new THREE.Float32BufferAttribute(shoulderPositions, 3));
    shoulderGeo.setAttribute('color', new THREE.Float32BufferAttribute(shoulderColors, 3));
    shoulderGeo.setIndex(shoulderIndices);
    shoulderGeo.computeVertexNormals();

    const shoulderMesh = new THREE.Mesh(shoulderGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    this.shoulderGroup.add(shoulderMesh);

    const terrainGeo = new THREE.BufferGeometry();
    terrainGeo.setAttribute('position', new THREE.Float32BufferAttribute(terrainPositions, 3));
    terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(terrainColors, 3));
    terrainGeo.setIndex(terrainIndices);
    terrainGeo.computeVertexNormals();

    const terrainMesh = new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
    this.sceneryGroup.add(terrainMesh);

    // 1. Props: Telegraph poles along left shoulder every 45m
    for (let s = startS; s < endS; s += 45.0) {
      const info = this.getRoadTransformAt(s);
      const pole = window.ATR.TrackProps.createTelegraphPole();
      pole.position.copy(info.center).addScaledVector(info.normal, -(roadHalfWidth + shoulderWidth + 2.0));
      pole.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), info.tangent);
      this.sceneryGroup.add(pole);
      chunkProps.push(pole);
    }

    // 2. Props: Billboards every 120m
    const slot = Math.floor(startS / 120.0);
    const bS = slot * 120.0 + 30.0;
    if (bS >= startS && bS < endS && startS > 100.0) {
      const info = this.getRoadTransformAt(bS);
      const board = window.ATR.TrackProps.createBillboard(this.billboardTextures[slot % this.billboardTextures.length]);
      const side = slot % 2 === 0 ? 1 : -1;
      board.position.copy(info.center).addScaledVector(info.normal, side * (roadHalfWidth + shoulderWidth + 5.5));
      board.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), info.tangent.clone().negate());
      this.sceneryGroup.add(board);
      chunkProps.push(board);
    }

    // 3. Stage Milestone Banner every 1500m
    const stageSlot = Math.floor(startS / 1500.0);
    const stageS = stageSlot * 1500.0;
    if (stageS >= startS && stageS < endS && startS > 100.0) {
      const gantry = window.ATR.TrackProps.createBanner(`STAGE ${stageSlot + 1} CHECKPOINT`, this.roadWidth, '#0066ff');
      const roadInfo = this.getRoadTransformAt(stageS);
      gantry.position.copy(roadInfo.center);
      gantry.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), roadInfo.tangent.clone().negate());
      this.sceneryGroup.add(gantry);
      chunkProps.push(gantry);
    }

    // 4. Biome Vegetation & Roadside Props
    for (let step = 0; step < 4; step++) {
      const propS = startS + step * 18.0 + 8.0;
      const side = (step % 2 === 0) ? 1 : -1;
      const roadInfo = this.getRoadTransformAt(propS);
      const distFromCenter = roadHalfWidth + shoulderWidth + 3.5 + (step % 3) * 6.0;
      const propPos = roadInfo.center.clone().addScaledVector(roadInfo.normal, side * distFromCenter);

      let plant;
      if (biome === 'DESERT') plant = window.ATR.TrackProps.createCactus();
      else if (biome === 'SNOW') plant = window.ATR.TrackProps.createSnowPine();
      else if (biome === 'TROPICAL') plant = window.ATR.TrackProps.createPalmTree();
      else if (biome === 'MIDNIGHT') plant = window.ATR.TrackProps.createCyberLamp();
      else plant = window.ATR.TrackProps.createTree();

      plant.position.copy(propPos);
      this.sceneryGroup.add(plant);
      chunkProps.push(plant);
    }

    // 5. Dynamic Obstacles (Logs, Rocks, Oil Slicks - Alternating sides across highway)
    if (startS > 180.0 && chunkIndex % 2 === 0) {
      const obsS = startS + 37.5;
      const roadInfo = this.getRoadTransformAt(obsS);
      const roadUp = new THREE.Vector3().crossVectors(roadInfo.normal, roadInfo.tangent).normalize();
      const pattern = Math.floor(chunkIndex / 2) % 4;

      if (pattern === 0) {
        // Oil Slick
        const laneOffset = (Math.sin(chunkIndex * 13) * 0.45);
        const oilPos = roadInfo.center.clone().addScaledVector(roadInfo.normal, laneOffset * roadHalfWidth);
        const oilMesh = new THREE.Mesh(
          new THREE.CircleGeometry(2.0, 8),
          new THREE.MeshBasicMaterial({ color: 0x111115, opacity: 0.85, transparent: true, side: THREE.DoubleSide })
        );
        oilMesh.rotation.x = -Math.PI / 2;
        oilMesh.position.copy(oilPos).addScaledVector(roadUp, 0.08);

        this.sceneryGroup.add(oilMesh);
        chunkProps.push(oilMesh);

        const obsObj = { type: 'OIL', distance: obsS, t: obsS, side: 0, position: oilPos, radius: 2.0 };
        this.obstacles.push(obsObj);
        chunkObstacles.push(obsObj);

      } else if (pattern === 1 || pattern === 3) {
        // Fallen Log Obstacle (alternates Left and Right)
        const side = (Math.floor(chunkIndex / 4) % 2 === 0) ? 1 : -1;
        const halfRoadCenter = side * (this.roadWidth * 0.25);
        const obsPos = roadInfo.center.clone().addScaledVector(roadInfo.normal, halfRoadCenter);

        const logMesh = window.ATR.TrackProps.createLog(this.roadWidth * 0.48);
        const forward = roadInfo.tangent.clone().negate();
        const basisMatrix = new THREE.Matrix4().makeBasis(roadInfo.normal, roadUp, forward);
        logMesh.quaternion.setFromRotationMatrix(basisMatrix);
        logMesh.position.copy(obsPos).addScaledVector(roadUp, 0.25);

        this.sceneryGroup.add(logMesh);
        chunkProps.push(logMesh);

        const obsObj = { type: 'LOG', distance: obsS, t: obsS, side, position: obsPos, radius: this.roadWidth * 0.26 };
        this.obstacles.push(obsObj);
        chunkObstacles.push(obsObj);

      } else if (pattern === 2) {
        // Road Rock Cluster Obstacle (alternates Left and Right)
        const side = (Math.floor(chunkIndex / 8) % 2 === 0) ? 1 : -1;
        const halfRoadCenter = side * (this.roadWidth * 0.25);
        const obsPos = roadInfo.center.clone().addScaledVector(roadInfo.normal, halfRoadCenter);

        const rockMesh = window.ATR.TrackProps.createRoadRockCluster(this.roadWidth * 0.46);
        const forward = roadInfo.tangent.clone().negate();
        const basisMatrix = new THREE.Matrix4().makeBasis(roadInfo.normal, roadUp, forward);
        rockMesh.quaternion.setFromRotationMatrix(basisMatrix);
        rockMesh.position.copy(obsPos).addScaledVector(roadUp, 0.25);

        this.sceneryGroup.add(rockMesh);
        chunkProps.push(rockMesh);

        const obsObj = { type: 'ROCK', distance: obsS, t: obsS, side, position: obsPos, radius: this.roadWidth * 0.26 };
        this.obstacles.push(obsObj);
        chunkObstacles.push(obsObj);
      }
    }

    return { roadMesh, shoulderMesh, terrainMesh, props: chunkProps, obstacles: chunkObstacles };
  }

  disposeChunk(chunk) {
    if (!chunk) return;
    this.roadGroup.remove(chunk.roadMesh);
    chunk.roadMesh.geometry?.dispose();

    this.shoulderGroup.remove(chunk.shoulderMesh);
    chunk.shoulderMesh.geometry?.dispose();
    chunk.shoulderMesh.material?.dispose();

    this.sceneryGroup.remove(chunk.terrainMesh);
    chunk.terrainMesh.geometry?.dispose();
    chunk.terrainMesh.material?.dispose();

    for (let p of chunk.props) {
      this.sceneryGroup.remove(p);
      p.traverse(c => c.geometry?.dispose());
    }

    for (let o of chunk.obstacles) {
      const idx = this.obstacles.indexOf(o);
      if (idx !== -1) this.obstacles.splice(idx, 1);
    }
  }

  dispose() {
    for (let chunk of this.activeChunks.values()) {
      this.disposeChunk(chunk);
    }
    this.activeChunks.clear();
    this.obstacles.length = 0;
    this.waypoints.length = 0;
    this.scene.remove(this.roadGroup, this.shoulderGroup, this.sceneryGroup);
    this.roadTexture?.dispose();
    this.billboardTextures.forEach(t => t.dispose());
    if (this.clouds?.dispose) this.clouds.dispose();
  }

  buildStartGantry() {
    const banner = window.ATR.TrackProps.createBanner('LOTUS ENDLESS HIGHWAY', this.roadWidth, '#ff0055');
    const info = this.getRoadTransformAt(10.0);
    banner.position.copy(info.center);
    banner.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), info.tangent.clone().negate());
    this.sceneryGroup.add(banner);
  }
}

window.ATR.InfiniteLotusTrack = InfiniteLotusTrack;
