/* ===================================================
   AMIGA TURBO RACER - PROCEDURAL PROPS & SCENERY FACTORY
   Provides shared procedural 3D models for roadside props,
   obstacles, environmental foliage, billboards, and signage
   used across both standard circuits and the infinite highway.
   =================================================== */

window.ATR = window.ATR || {};

class TrackProps {
  /**
   * Standard deciduous / coniferous forest tree with multi-tiered cone foliage
   */
  static createTree(leavesColors = [0x235c39, 0x1b4332, 0x2d6a4f]) {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.9 });
    const leafColor = leavesColors[Math.floor(Math.random() * leavesColors.length)];
    const leavesMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.8, flatShading: true });

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

  /**
   * Tropical Palm Tree with curved segmented trunk, coconuts, and fronds
   */
  static createPalmTree() {
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

  /**
   * Desert Saguaro Cactus with branching arms
   */
  static createCactus() {
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

  /**
   * Alpine Snowy Pine tree with snowy caps
   */
  static createSnowPine() {
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

  /**
   * Neon Cyber Street Lamp for Midnight tracks
   */
  static createCyberLamp() {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6.5, 6), new THREE.MeshStandardMaterial({ color: 0x334155 }));
    pole.position.y = 3.25;

    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.4), new THREE.MeshBasicMaterial({ color: 0x00ffff }));
    lamp.position.set(0.4, 6.3, 0);

    group.add(pole, lamp);
    return group;
  }

  /**
   * Low-poly decorative roadside rock / boulder
   */
  static createRock(isBig = false, envType = 'FOREST') {
    const radius = isBig ? (3.8 + Math.random() * 2.8) : (1.4 + Math.random() * 1.2);
    const geo = new THREE.DodecahedronGeometry(radius, 0);
    const rockColor = envType === 'DESERT' ? 0x9e6a45 : (envType === 'TROPICAL' ? 0x55606d : 0x777788);
    const mat = new THREE.MeshStandardMaterial({ color: rockColor, roughness: 0.9, flatShading: true });
    const rock = new THREE.Mesh(geo, mat);
    rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    return rock;
  }

  /**
   * Fallen Tree Log Obstacle with cut caps and side branch
   */
  static createLog(length = 6.8) {
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

  /**
   * Multi-boulder Road Rock Cluster Obstacle
   */
  static createRoadRockCluster(width = 6.2) {
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

  /**
   * Classic Amiga Lotus wooden telegraph pole with crossbar and insulators
   */
  static createTelegraphPole() {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.9, flatShading: true });
    const insMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6.5, 6), woodMat);
    pole.position.y = 3.25;

    const crossbar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 0.16), woodMat);
    crossbar.position.set(0, 5.8, 0);

    for (let x = -0.9; x <= 0.9; x += 0.6) {
      const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 5), insMat);
      ins.position.set(x, 5.95, 0);
      group.add(ins);
    }

    group.add(pole, crossbar);
    return group;
  }

  /**
   * Roadside Billboard with twin posts and textured sign
   */
  static createBillboard(texture) {
    const group = new THREE.Group();
    const postMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });

    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.5, 0.3), postMat);
    const p2 = p1.clone();
    p1.position.set(-2.5, 2.75, 0);
    p2.position.set(2.5, 2.75, 0);

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(6.2, 3.2, 0.3),
      new THREE.MeshBasicMaterial({ map: texture })
    );
    board.position.y = 4.2;

    group.add(p1, p2, board);
    return group;
  }

  /**
   * High-visibility retro arcade corner chevron sign
   */
  static createCornerSign(direction = 'RIGHT') {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.2), new THREE.MeshBasicMaterial({ color: 0xdddddd }));
    pole.position.y = 1.6;

    const boardCanvas = document.createElement('canvas');
    boardCanvas.width = 128;
    boardCanvas.height = 64;
    const ctx = boardCanvas.getContext('2d');

    ctx.fillStyle = '#e6004c';
    ctx.fillRect(0, 0, 128, 64);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 124, 60);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 42px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(direction === 'RIGHT' ? '>>>' : '<<<', 64, 34);

    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 1.3),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(boardCanvas), side: THREE.DoubleSide })
    );
    board.position.y = 2.4;

    group.add(pole, board);
    return group;
  }

  /**
   * Overhead track gantry / banner (e.g. START/FINISH, STAGE CHECKPOINTS)
   */
  static createBanner(titleText = 'START / FINISH', roadWidth = 14.0, bgColor = '#ff0055') {
    const group = new THREE.Group();
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x222222 });

    const postOffset = (roadWidth * 0.5) + 2.5;
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8.5, 0.8), pillarMat);
    const p2 = p1.clone();
    p1.position.set(-postOffset, 4.25, 0);
    p2.position.set(postOffset, 4.25, 0);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(titleText, 128, 42);

    const bannerTex = new THREE.CanvasTexture(canvas);
    const bannerMesh = new THREE.Mesh(
      new THREE.BoxGeometry(roadWidth + 5.0, 2.5, 0.5),
      new THREE.MeshBasicMaterial({ map: bannerTex })
    );
    bannerMesh.position.y = 7.5;

    group.add(p1, p2, bannerMesh);
    return group;
  }

  /**
   * Roadside Pit Stop Service Signboard
   */
  static createPitTrafficSign() {
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
}

window.ATR.TrackProps = TrackProps;
