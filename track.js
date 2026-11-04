/* ===================================================
   AMIGA TURBO RACER - CLOSED CIRCUIT TRACK BUILDER
   Constructs standard circuits, the Daytona NASCAR oval,
   road ribbon geometry, curbs, roadside props, and pit lane.
   Serves as entry facade delegating to InfiniteLotusTrack.
   =================================================== */

window.ATR = window.ATR || {};

class Track {
  constructor(scene, trackData) {
    // If LOTUS or LOTUS_SUPERWIDE endless highway selected, instantiate and return InfiniteLotusTrack
    if (trackData && (trackData.mapLayout === 'LOTUS' || trackData.mapLayout === 'LOTUS_SUPERWIDE' || trackData.isInfinite)) {
      return new window.ATR.InfiniteLotusTrack(scene, trackData);
    }

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
    this.buildCornerSigns();
    this.buildObstacles();

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

  dispose() {
    if (this.roadMesh) {
      this.scene.remove(this.roadMesh);
      if (this.roadMesh.geometry) this.roadMesh.geometry.dispose();
      if (this.roadMesh.material) this.roadMesh.material.dispose();
    }
    if (this.shoulderMesh) {
      this.scene.remove(this.shoulderMesh);
      if (this.shoulderMesh.geometry) this.shoulderMesh.geometry.dispose();
      if (this.shoulderMesh.material) this.shoulderMesh.material.dispose();
    }
    if (this.terrainMesh) {
      this.scene.remove(this.terrainMesh);
      if (this.terrainMesh.geometry) this.terrainMesh.geometry.dispose();
      if (this.terrainMesh.material) this.terrainMesh.material.dispose();
    }
    if (this.sceneryGroup) {
      this.scene.remove(this.sceneryGroup);
      this.sceneryGroup.traverse(c => {
        if (c.geometry) c.geometry.dispose();
      });
    }
    if (this.clouds && typeof this.clouds.dispose === 'function') {
      this.clouds.dispose();
    }
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
      const r = 0.95;
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
    const startInfo = this.getRoadTransformAt(0.01);
    const banner = window.ATR.TrackProps.createBanner('FINISH / START', this.roadWidth, '#ff0055');
    banner.position.copy(startInfo.center);
    banner.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), startInfo.tangent.clone().negate());
    this.sceneryGroup.add(banner);
  }

  buildPitLane() {
    const pitGroup = new THREE.Group();

    const signT = 0.026;
    const signInfo = this.getRoadTransformAt(signT);
    const signOffset = (this.roadWidth * 0.5) + 2.5;

    const pitSignGroup = window.ATR.TrackProps.createPitTrafficSign();
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

      const outerSide = (isOval && this.data.counterClockwise) ? -1 : 1;
      const baseDist = (this.roadWidth * 0.5) + (isOval ? 8 : 4);
      let distFromRoad = baseDist + (i % 5) * 6;

      if (isOval && side === outerSide) {
        distFromRoad = (this.roadWidth * 0.5) + this.shoulderWidth;
      }

      const objPos = point.clone().addScaledVector(normal, side * distFromRoad);
      if (isOval && side === outerSide) {
        objPos.addScaledVector(roadUp, 0.06);
      }

      if (i % 3 === 0) {
        let plant;
        if (this.data.envType === 'TROPICAL') plant = window.ATR.TrackProps.createPalmTree();
        else if (this.data.envType === 'DESERT') plant = window.ATR.TrackProps.createCactus();
        else if (this.data.envType === 'SNOW') plant = window.ATR.TrackProps.createSnowPine();
        else plant = window.ATR.TrackProps.createTree(this.theme.treeLeaves);

        const plantY = isOval ? objPos.y : 0;
        plant.position.set(objPos.x, plantY, objPos.z);
        this.sceneryGroup.add(plant);

      } else if (i % 3 === 1) {
        const isBigBoulder = (i % 6 === 1);
        const rock = window.ATR.TrackProps.createRock(isBigBoulder, this.data.envType);
        const rockY = isOval
          ? (side === outerSide ? objPos.y + (isBigBoulder ? 0.6 : 0.2) : objPos.y + (isBigBoulder ? 1.4 : 0.4))
          : (isBigBoulder ? 1.2 : 0.4);

        rock.position.set(objPos.x, rockY, objPos.z);
        this.sceneryGroup.add(rock);

      } else {
        const isBig = (i % 2 === 0);
        const extraRock = window.ATR.TrackProps.createRock(isBig, this.data.envType);
        const rockY = isOval ? (objPos.y + 0.3) : (isBig ? 1.0 : 0.3);
        extraRock.position.set(objPos.x, rockY, objPos.z);
        this.sceneryGroup.add(extraRock);
      }
    }
  }

  buildCornerSigns() {
    const samples = (this.data.mapLayout === 'OVAL') ? 320 : 360;
    const minSpacingDist = 20.0;
    const minSpacingT = minSpacingDist / this.totalLength;
    const dt = 0.007;
    let lastSignT = -999;

    for (let i = 0; i < samples; i++) {
      const t = i / samples;
      if (t > 0.0 && t < 0.09) continue;
      if (t > 0.98) continue;
      if (Math.abs(t - lastSignT) < minSpacingT) continue;

      const tPrev = ((t - dt) % 1.0 + 1.0) % 1.0;
      const tNext = (t + dt) % 1.0;

      const roadInfo = this.getRoadTransformAt(t);
      const tanPrev = this.spline.getTangentAt(tPrev).normalize();
      const tanNext = this.spline.getTangentAt(tNext).normalize();
      const deltaTan = tanNext.sub(tanPrev);
      const turnVal = deltaTan.dot(roadInfo.normal);

      if (Math.abs(turnVal) < 0.035) continue;

      const isRightTurn = turnVal > 0;
      const signDirection = isRightTurn ? 'RIGHT' : 'LEFT';
      const outerSide = isRightTurn ? -1 : 1;

      const sign = window.ATR.TrackProps.createCornerSign(signDirection);
      const signOffset = (this.roadWidth * 0.5) + this.shoulderWidth + 1.2;
      const roadUp = new THREE.Vector3().crossVectors(roadInfo.normal, roadInfo.tangent).normalize();
      const signForward = roadInfo.tangent.clone().negate();

      const basisMatrix = new THREE.Matrix4().makeBasis(roadInfo.normal, roadUp, signForward);
      sign.quaternion.setFromRotationMatrix(basisMatrix);

      const signPos = roadInfo.center.clone()
        .addScaledVector(roadInfo.normal, outerSide * signOffset)
        .addScaledVector(roadUp, 0.05);
      sign.position.copy(signPos);

      this.sceneryGroup.add(sign);
      lastSignT = t;
    }
  }

  buildObstacles() {
    if (this.data.mapLayout === 'OVAL') return;

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
          distance: currentT * this.totalLength,
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

    let mesh = type === 'LOG'
      ? window.ATR.TrackProps.createLog(this.roadWidth * 0.48)
      : window.ATR.TrackProps.createRoadRockCluster(this.roadWidth * 0.46);

    const roadUp = new THREE.Vector3().crossVectors(tInfo.normal, tInfo.tangent).normalize();
    const forward = tInfo.tangent.clone().negate();
    const basisMatrix = new THREE.Matrix4().makeBasis(tInfo.normal, roadUp, forward);

    mesh.quaternion.setFromRotationMatrix(basisMatrix);
    mesh.position.copy(obsPos).addScaledVector(roadUp, 0.25);

    this.sceneryGroup.add(mesh);
    this.obstacles.push({
      type,
      t,
      distance: t * this.totalLength,
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
    if (this.data.mapLayout === 'OVAL') {
      const turnDeflection = Math.abs(tangent.x);
      const p = Math.min(1.0, Math.max(0.0, (turnDeflection - 0.04) / 0.66));
      const w = p * p * p * (p * (p * 6 - 15) + 10);
      const ovalBank = 0.21 + w * 0.38;
      bankAngle = this.data.counterClockwise ? ovalBank : -ovalBank;
    }

    if (Math.abs(bankAngle) > 0.005) {
      normal.applyAxisAngle(tangent, bankAngle);
    }

    return { center, tangent, normal, bankAngle, t: normalizedT };
  }
}

window.ATR.Track = Track;
