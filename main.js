/* ===================================================
   AMIGA TURBO RACER - MAIN CONTROLLER & SPLIT ENGINE
   Handles Three.js rendering, horizontal split-screen
   scissor testing, fullscreen single-player, camera shake,
   dynamic speed FOV, gamepad/keyboard inputs, minimap,
   and game states.
   =================================================== */

window.ATR = window.ATR || {};

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.container = document.getElementById('game-container');

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0c18);

    // Perspective Cameras with extended draw distance
    this.cameraP1 = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.5, 2000);
    this.cameraP2 = new THREE.PerspectiveCamera(70, window.innerWidth / (window.innerHeight / 2), 0.5, 2000);

    // Dynamic Lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444455, 1.2);
    hemiLight.position.set(0, 50, 0);
    const sunLight = new THREE.DirectionalLight(0xffffff, 0.9);
    sunLight.position.set(100, 150, -50);
    this.scene.add(hemiLight, sunLight);

    this.mode = 'SINGLE';
    this.state = 'MENU';
    this.seed = 849271;
    this.envType = 'FOREST';
    this.totalLaps = 3;
    this.clock = new THREE.Clock();

    this.keys = {};
    this.setupInputs();

    this.track = null;
    this.player1 = null;
    this.player2 = null;
    this.aiCars = [];
    this.allCars = [];
    this.shakeIntensity = 0;
    this.smokeSystem = null;

    // Minimap references
    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;
    this.minimapBounds = null;
    this.minimapTrackPoints = null;

    // Menu Showcase Car
    this.showcaseCar = window.ATR.CarModelFactory.createWedgeCar(0xff0044, true);
    this.showcaseCar.position.set(0, 0, -6);
    this.scene.add(this.showcaseCar);

    this.setupUI();
    this.setupWindowEvents();

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  setupInputs() {
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (window.ATR.Audio && !window.ATR.Audio.isStarted) {
        window.ATR.Audio.init();
      }
    });
    window.addEventListener('keyup', e => {
      this.keys[e.code] = false;
    });
  }

  setupWindowEvents() {
    window.addEventListener('resize', () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.renderer.setSize(w, h);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      if (this.mode === 'TWO_PLAYER') {
        this.cameraP1.aspect = w / (h / 2);
        this.cameraP2.aspect = w / (h / 2);
      } else {
        this.cameraP1.aspect = w / h;
      }
      this.cameraP1.updateProjectionMatrix();
      this.cameraP2.updateProjectionMatrix();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.clock.stop();
      } else {
        this.clock.start();
      }
    });
  }

  setupUI() {
    document.getElementById('btn-single-player').onclick = () => this.startRace('SINGLE');
    document.getElementById('btn-two-player').onclick = () => this.startRace('TWO_PLAYER');
    document.getElementById('btn-practice').onclick = () => this.startRace('PRACTICE');
    document.getElementById('btn-random-track').onclick = () => {
      this.seed = Math.floor(100000 + Math.random() * 900000);
      document.getElementById('menu-seed-display').innerText = this.seed;
    };

    document.getElementById('btn-options').onclick = () => {
      document.getElementById('main-menu').classList.add('hidden');
      document.getElementById('options-menu').classList.remove('hidden');
    };

    document.getElementById('btn-options-back').onclick = () => {
      this.envType = document.getElementById('opt-env').value;
      this.totalLaps = parseInt(document.getElementById('opt-laps').value, 10);
      const vol = parseInt(document.getElementById('opt-volume').value, 10) / 100;
      window.ATR.Audio.setVolume(vol);

      document.getElementById('options-menu').classList.add('hidden');
      document.getElementById('main-menu').classList.remove('hidden');
    };

    document.getElementById('btn-results-retry').onclick = () => this.startRace(this.mode);
    document.getElementById('btn-results-new').onclick = () => {
      this.seed = Math.floor(100000 + Math.random() * 900000);
      this.startRace(this.mode);
    };
    document.getElementById('btn-results-menu').onclick = () => this.returnToMenu();
  }

  startRace(mode = 'SINGLE') {
    this.mode = mode;
    this.state = 'COUNTDOWN';

    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('options-menu').classList.add('hidden');
    document.getElementById('results-screen').classList.add('hidden');
    this.showcaseCar.visible = false;

    const isSplit = (mode === 'TWO_PLAYER');
    document.body.classList.toggle('split-screen', isSplit);
    document.getElementById('split-divider').classList.toggle('hidden', !isSplit);
    document.getElementById('hud-p1').classList.remove('hidden');
    document.getElementById('hud-p2').classList.toggle('hidden', !isSplit);
    document.getElementById('hint-p2-card').classList.toggle('hidden', !isSplit);
    document.getElementById('controls-hint').classList.remove('hidden');
    document.getElementById('minimap-container').classList.remove('hidden');

    if (this.track) {
      this.scene.remove(this.track.roadMesh);
      this.scene.remove(this.track.shoulderMesh);
      this.scene.remove(this.track.terrainMesh);
      this.scene.remove(this.track.sceneryGroup);
    }
    this.allCars.forEach(c => this.scene.remove(c.mesh));
    this.allCars = [];
    this.aiCars = [];

    // Initialize or clear particle system
    if (this.smokeSystem) {
      this.smokeSystem.clear();
    } else if (window.ATR.SmokeParticleSystem) {
      this.smokeSystem = new window.ATR.SmokeParticleSystem(this.scene);
      window.ATR.smokeSystem = this.smokeSystem;
    }

    // Generate Guaranteed Continuous Circuit
    const generator = new window.ATR.TrackGenerator();
    const trackData = generator.generate(this.seed, 'MEDIUM', this.envType, 50);
    this.track = new window.ATR.Track(this.scene, trackData);
    this.initMinimapTrack();

    // Player 1 (Red Supercar) starts on Main Straight
    this.player1 = new window.ATR.Car(this.scene, {
      name: 'PLAYER 1',
      isPlayer: true,
      playerNum: 1,
      color: 0xe62222,
      startT: 0.04,
      laneOffset: isSplit ? -0.35 : -0.2
    });
    this.allCars.push(this.player1);

    // Player 2 (Cyan Supercar)
    if (isSplit) {
      this.player2 = new window.ATR.Car(this.scene, {
        name: 'PLAYER 2',
        isPlayer: true,
        playerNum: 2,
        color: 0x00bfff,
        startT: 0.04,
        laneOffset: 0.35
      });
      this.allCars.push(this.player2);
    } else {
      this.player2 = null;
    }

    // 19 AI Competitors lined up on starting grid
    const aiCount = mode === 'PRACTICE' ? 0 : (isSplit ? 18 : 19);
    for (let i = 0; i < aiCount; i++) {
      const row = Math.floor(i / 2) + 1;
      const lane = (i % 2 === 0 ? 0.35 : -0.35);
      const startT = (0.04 - row * 0.0035 + 1.0) % 1.0;
      const name = window.ATR.AMIGA_NAMES[i % window.ATR.AMIGA_NAMES.length];
      const color = window.ATR.AI_PALETTE[i % window.ATR.AI_PALETTE.length];

      const aiCar = new window.ATR.Car(this.scene, {
        name,
        isPlayer: false,
        color,
        startT,
        laneOffset: lane
      });

      const controller = new window.ATR.AIController(aiCar, this.track, 0.9 + Math.random() * 0.2);
      this.aiCars.push(controller);
      this.allCars.push(aiCar);
    }

    // Immediately calculate initial world positions
    this.allCars.forEach(car => car.updatePhysics(0.001, this.track));

    // Instantly snap cameras directly behind racers
    this.snapCameraToCar(this.cameraP1, this.player1);
    if (this.player2) {
      this.snapCameraToCar(this.cameraP2, this.player2);
    }

    window.ATR.Audio.startEngines(isSplit);
    this.runCountdown();
  }

  snapCameraToCar(camera, car) {
    const roadInfo = this.track.getRoadTransformAt(car.trackT);
    const camOffset = roadInfo.tangent.clone().multiplyScalar(-9.5).add(new THREE.Vector3(0, 3.4, 0));
    camera.position.copy(car.mesh.position).add(camOffset);
    camera.lookAt(car.mesh.position.clone().add(roadInfo.tangent.clone().multiplyScalar(15)).add(new THREE.Vector3(0, 1.2, 0)));
  }

  runCountdown() {
    const banner = document.getElementById('countdown-banner');
    const text = document.getElementById('countdown-text');
    banner.classList.remove('hidden');

    let count = 3;
    text.innerText = count;
    window.ATR.Audio.playBeep(false);

    const timer = setInterval(() => {
      count--;
      if (count > 0) {
        text.innerText = count;
        window.ATR.Audio.playBeep(false);
      } else if (count === 0) {
        text.innerText = 'GO!';
        window.ATR.Audio.playBeep(true);
        this.state = 'RACING';
      } else {
        clearInterval(timer);
        banner.classList.add('hidden');
      }
    }, 1000);
  }

  handlePlayerInput(player, delta) {
    if (!player || this.state !== 'RACING') return;

    const isP1 = (player.playerNum === 1);

    const upKey    = isP1 ? 'ArrowUp' : 'KeyW';
    const downKey  = isP1 ? 'ArrowDown' : 'KeyS';
    const leftKey  = isP1 ? 'ArrowLeft' : 'KeyA';
    const rightKey = isP1 ? 'ArrowRight' : 'KeyD';
    const turboKey = isP1 ? 'ShiftRight' : 'Space';

    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = gamepads[player.playerNum - 1];

    let accel = this.keys[upKey];
    let brake = this.keys[downKey];
    let steerL = this.keys[leftKey];
    let steerR = this.keys[rightKey];
    let turbo = this.keys[turboKey];

    if (pad) {
      if (pad.buttons[7] && pad.buttons[7].pressed) accel = true;
      if (pad.buttons[6] && pad.buttons[6].pressed) brake = true;
      if (pad.buttons[0] && pad.buttons[0].pressed) turbo = true;
      if (pad.axes[0] < -0.2) steerL = true;
      if (pad.axes[0] > 0.2) steerR = true;
    }

    if (accel) player.accelerate(delta);
    if (brake) player.brake(delta);
    if (steerL) player.steer(-1, delta);
    if (steerR) player.steer(1, delta);
    if (turbo) player.activateTurbo();

    for (let obs of this.track.obstacles) {
      const dist = player.mesh.position.distanceTo(obs.position);
      if (dist < obs.radius) {
        player.hitHazard(obs.type);
        this.shakeIntensity = obs.type === 'OIL' ? 0.5 : 1.3;
      }
    }

    if (this.track.pitZone) {
      const pDist = player.mesh.position.distanceTo(this.track.pitZone.center);
      const isRefueling = (pDist < 14.0 && player.speed < 45.0);
      const pitTag = document.getElementById(isP1 ? 'p1-pit-msg' : 'p2-pit-msg');

      if (isRefueling) {
        player.fuel = Math.min(100, player.fuel + 40 * delta);
        if (pitTag) pitTag.classList.remove('hidden');
      } else {
        if (pitTag) pitTag.classList.add('hidden');
      }
    }

    const speedRatio = player.speed / player.maxSpeed;
    window.ATR.Audio.updateEngine(player.playerNum, speedRatio, accel);
  }

  updateCamera(camera, car, aspect, delta) {
    if (!car) return;

    const roadInfo = this.track.getRoadTransformAt(car.trackT);
    const camOffset = roadInfo.tangent.clone().multiplyScalar(-9.5).add(new THREE.Vector3(0, 3.4, 0));
    const targetCamPos = car.mesh.position.clone().add(camOffset);

    if (this.shakeIntensity > 0) {
      targetCamPos.x += (Math.random() - 0.5) * this.shakeIntensity;
      targetCamPos.y += (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity = Math.max(0, this.shakeIntensity - delta * 1.5);
    }

    camera.position.lerp(targetCamPos, 0.2);
    const lookTarget = car.mesh.position.clone().add(roadInfo.tangent.clone().multiplyScalar(15)).add(new THREE.Vector3(0, 1.2, 0));
    camera.lookAt(lookTarget);

    const speedRatio = car.speed / car.maxSpeed;
    camera.fov = 70 + speedRatio * 12.0;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }

  formatTime(seconds) {
    if (!seconds || seconds <= 0) return '00:00.00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }

  updateHUD(player, hudPrefix) {
    if (!player) return;

    const spdEl = document.getElementById(`${hudPrefix}-speed`);
    if (spdEl) spdEl.innerText = Math.round(player.speed).toString().padStart(3, '0');

    const sorted = [...this.allCars].sort((a, b) => {
      if (b.lap !== a.lap) return b.lap - a.lap;
      return b.trackT - a.trackT;
    });
    const rank = sorted.indexOf(player) + 1;
    const posEl = document.getElementById(`${hudPrefix}-pos`);
    if (posEl) posEl.innerText = `${rank.toString().padStart(2, '0')}/${this.allCars.length}`;

    const lapEl = document.getElementById(`${hudPrefix}-lap`);
    if (lapEl) lapEl.innerText = `${Math.min(player.lap, this.totalLaps)}/${this.totalLaps}`;

    const timeEl = document.getElementById(`${hudPrefix}-time`);
    if (timeEl) {
      timeEl.innerText = this.formatTime(player.currentLapTime);
    }

    const fuelBar = document.getElementById(`${hudPrefix}-fuel-bar`);
    if (fuelBar) {
      fuelBar.style.width = `${player.fuel}%`;
      fuelBar.classList.toggle('low-fuel', player.fuel < 22);
    }

    const turboBar = document.getElementById(`${hudPrefix}-turbo-bar`);
    if (turboBar) turboBar.style.width = `${player.turbo}%`;

    if (player.lap > this.totalLaps && !player.finished) {
      player.finished = true;
      if (this.state === 'RACING') {
        this.finishRace();
      }
    }
  }

  initMinimapTrack() {
    if (!this.track || !this.track.spline) return;
    const samples = 140;
    const pts = [];
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;

    for (let i = 0; i <= samples; i++) {
      const p = this.track.spline.getPointAt(i / samples);
      pts.push({ x: p.x, z: p.z });
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }

    this.minimapTrackPoints = pts;
    this.minimapBounds = { minX, maxX, minZ, maxZ };
  }

  updateMinimap() {
    if (!this.minimapCtx || !this.minimapBounds || !this.minimapTrackPoints) return;
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    const pad = 14;

    ctx.clearRect(0, 0, w, h);

    const { minX, maxX, minZ, maxZ } = this.minimapBounds;
    const spanX = maxX - minX || 1;
    const spanZ = maxZ - minZ || 1;

    const toMap = (x, z) => ({
      x: pad + ((x - minX) / spanX) * (w - pad * 2),
      y: pad + ((z - minZ) / spanZ) * (h - pad * 2)
    });

    // 1. Draw Track Ribbon
    ctx.beginPath();
    const first = toMap(this.minimapTrackPoints[0].x, this.minimapTrackPoints[0].z);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < this.minimapTrackPoints.length; i++) {
      const pt = toMap(this.minimapTrackPoints[i].x, this.minimapTrackPoints[i].z);
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.closePath();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.strokeStyle = 'rgba(70, 160, 240, 0.75)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 2. Start/Finish Line Indicator
    const finishPos = toMap(this.track.spline.getPointAt(0.01).x, this.track.spline.getPointAt(0.01).z);
    ctx.fillStyle = '#ff0055';
    ctx.beginPath();
    ctx.arc(finishPos.x, finishPos.y, 3, 0, Math.PI * 2);
    ctx.fill();

    // 3. AI Racers
    for (let i = 0; i < this.aiCars.length; i++) {
      const car = this.aiCars[i].car;
      const pos = toMap(car.mesh.position.x, car.mesh.position.z);
      ctx.fillStyle = 'rgba(210, 220, 230, 0.7)';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Player 2 (Cyan with white rim)
    if (this.player2) {
      const p2Pos = toMap(this.player2.mesh.position.x, this.player2.mesh.position.z);
      ctx.fillStyle = '#00c3ff';
      ctx.beginPath();
      ctx.arc(p2Pos.x, p2Pos.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 5. Player 1 (Red with white rim)
    if (this.player1) {
      const p1Pos = toMap(this.player1.mesh.position.x, this.player1.mesh.position.z);
      ctx.fillStyle = '#ff2244';
      ctx.beginPath();
      ctx.arc(p1Pos.x, p1Pos.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  finishRace() {
    this.state = 'FINISHED';
    window.ATR.Audio.stopEngines();

    const results = document.getElementById('results-screen');
    const board = document.getElementById('results-board');
    results.classList.remove('hidden');

    const sorted = [...this.allCars].sort((a, b) => {
      if (b.lap !== a.lap) return b.lap - a.lap;
      return b.trackT - a.trackT;
    });

    let html = '';
    sorted.slice(0, 10).forEach((c, idx) => {
      const isP1 = (c === this.player1);
      const isP2 = (c === this.player2);
      const rowClass = isP1 ? 'p1-row' : (isP2 ? 'p2-row' : '');
      const timeStr = c.bestLapTime ? `BEST: ${this.formatTime(c.bestLapTime)}` : (c.finished ? 'FINISHED' : 'LAP ' + Math.min(c.lap, this.totalLaps));
      html += `
        <div class="results-row ${rowClass}">
          <span>${idx + 1}. ${c.name}</span>
          <span>${timeStr}</span>
        </div>
      `;
    });
    board.innerHTML = html;
  }

  returnToMenu() {
    this.state = 'MENU';
    document.getElementById('results-screen').classList.add('hidden');
    document.getElementById('hud-p1').classList.add('hidden');
    document.getElementById('hud-p2').classList.add('hidden');
    document.getElementById('split-divider').classList.add('hidden');
    document.getElementById('minimap-container').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');

    window.ATR.Audio.stopEngines();
    if (this.smokeSystem) {
      this.smokeSystem.clear();
    }
    this.showcaseCar.visible = true;
  }

  animate() {
    requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const width = window.innerWidth;
    const height = window.innerHeight;

    if (this.state === 'MENU') {
      this.showcaseCar.rotation.y += delta * 0.8;
      this.renderer.setViewport(0, 0, width, height);
      this.renderer.setScissorTest(false);
      this.cameraP1.position.set(0, 2.4, 4.5);
      this.cameraP1.lookAt(0, 0.4, -6);
      this.renderer.render(this.scene, this.cameraP1);
      return;
    }

    this.handlePlayerInput(this.player1, delta);
    if (this.player2) this.handlePlayerInput(this.player2, delta);

    // Update real-time lap timers while racing
    if (this.state === 'RACING') {
      if (this.player1 && !this.player1.finished) this.player1.currentLapTime += delta;
      if (this.player2 && !this.player2.finished) this.player2.currentLapTime += delta;
      for (let ai of this.aiCars) {
        if (!ai.car.finished) ai.car.currentLapTime += delta;
      }
    }

    for (let ai of this.aiCars) {
      ai.update(delta, this.allCars);
    }

    if (this.player1) this.player1.updatePhysics(delta, this.track);
    if (this.player2) this.player2.updatePhysics(delta, this.track);

    // Update smoke particles
    if (this.smokeSystem) {
      this.smokeSystem.update(delta);
    }

    this.updateHUD(this.player1, 'p1');
    if (this.player2) this.updateHUD(this.player2, 'p2');
    this.updateMinimap();

    if (this.mode === 'TWO_PLAYER' && this.player2) {
      const halfH = Math.floor(height / 2);
      this.renderer.setScissorTest(true);

      // Top Half: Player 1
      this.renderer.setViewport(0, halfH, width, halfH);
      this.renderer.setScissor(0, halfH, width, halfH);
      this.updateCamera(this.cameraP1, this.player1, width / halfH, delta);
      this.renderer.render(this.scene, this.cameraP1);

      // Bottom Half: Player 2
      this.renderer.setViewport(0, 0, width, halfH);
      this.renderer.setScissor(0, 0, width, halfH);
      this.updateCamera(this.cameraP2, this.player2, width / halfH, delta);
      this.renderer.render(this.scene, this.cameraP2);

      this.renderer.setScissorTest(false);
    } else {
      // Fullscreen Single Player
      this.renderer.setViewport(0, 0, width, height);
      this.renderer.setScissorTest(false);
      this.updateCamera(this.cameraP1, this.player1, width / height, delta);
      this.renderer.render(this.scene, this.cameraP1);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.gameApp = new Game();
});
