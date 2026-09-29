/* ===================================================
   AMIGA TURBO RACER - MAIN CONTROLLER & SPLIT ENGINE
   Handles Three.js rendering, horizontal split-screen,
   responsive full-window scaling, mobile touch controls,
   car collisions, obstacle interactions, and HUD states.
   =================================================== */

window.ATR = window.ATR || {};

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.container = document.getElementById('game-container');
    this.screenElement = document.getElementById('screen');

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0c18);

    // Perspective Cameras sized to browser window
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
    this.aiCount = 3; // Default 3 AI cars (4 total racers)
    this.clock = new THREE.Clock();

    this.keys = {};
    this.setupInputs();
    this.setupMobileControls();

    this.track = null;
    this.player1 = null;
    this.player2 = null;
    this.aiCars = [];
    this.allCars = [];
    this.shakeIntensity = 0;
    this.smokeSystem = null;

    // Minimap references (doubled buffer resolution for 2x crispness)
    this.minimapCanvas = document.getElementById('minimap-canvas');
    if (this.minimapCanvas) {
      this.minimapCanvas.width = 560;
      this.minimapCanvas.height = 560;
    }
    this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;
    this.minimapBounds = null;
    this.minimapTrackPoints = null;

    // Menu Showcase Car
    this.showcaseCar = window.ATR.CarModelFactory.createWedgeCar(0xff0044, true);
    this.showcaseCar.position.set(0, 0, -6);
    this.scene.add(this.showcaseCar);

    this.setupUI();
    this.setupWindowEvents();
    this.scaleGame();

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  scaleGame() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    if (this.screenElement) {
      this.screenElement.style.transform = 'none';
    }

    if (this.renderer) {
      this.renderer.setSize(w, h);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }

    if (this.cameraP1 && this.cameraP2) {
      if (this.mode === 'TWO_PLAYER') {
        this.cameraP1.aspect = w / (h / 2);
        this.cameraP2.aspect = w / (h / 2);
      } else {
        this.cameraP1.aspect = w / h;
      }
      this.cameraP1.updateProjectionMatrix();
      this.cameraP2.updateProjectionMatrix();
    }
  }

  toggleFullscreen() {
    const isFull = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (!isFull) {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      }
      document.body.classList.add('mobile-mode');
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
      document.body.classList.remove('mobile-mode');
    }
    setTimeout(() => this.scaleGame(), 100);
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

  setupMobileControls() {
    const mobileLeft = document.getElementById('mobile-left');
    const mobileRight = document.getElementById('mobile-right');
    const mobileUp = document.getElementById('mobile-up');
    const mobileDown = document.getElementById('mobile-down');
    const mobileTurbo = document.getElementById('mobile-turbo');

    const bindButton = (element, keyCodes) => {
      if (!element) return;
      const press = (e) => {
        if (e.cancelable) e.preventDefault();
        if (window.ATR.Audio && !window.ATR.Audio.isStarted) {
          window.ATR.Audio.init();
        }
        keyCodes.forEach(code => { this.keys[code] = true; });
      };
      const release = (e) => {
        if (e.cancelable) e.preventDefault();
        keyCodes.forEach(code => { this.keys[code] = false; });
      };

      element.addEventListener('touchstart', press, { passive: false });
      element.addEventListener('touchend', release, { passive: false });
      element.addEventListener('touchcancel', release, { passive: false });

      element.addEventListener('mousedown', press);
      element.addEventListener('mouseup', release);
      element.addEventListener('mouseleave', (e) => {
        if (e.buttons === 1) release(e);
      });
    };

    bindButton(mobileLeft, ['ArrowLeft', 'KeyA']);
    bindButton(mobileRight, ['ArrowRight', 'KeyD']);
    bindButton(mobileUp, ['ArrowUp', 'KeyW']);
    bindButton(mobileDown, ['ArrowDown', 'KeyS']);
    bindButton(mobileTurbo, ['ShiftRight', 'Space']);
  }

  setupWindowEvents() {
    const onResize = () => {
      this.scaleGame();
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('fullscreenchange', onResize);
    window.addEventListener('webkitfullscreenchange', onResize);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.clock.stop();
      } else {
        this.clock.start();
      }
    });
  }

  setupUI() {
    const mobileBtn = document.getElementById('mobile-btn');
    if (mobileBtn) {
      mobileBtn.onclick = () => {
        if (window.ATR.Audio && !window.ATR.Audio.isStarted) {
          window.ATR.Audio.init();
        }
        this.toggleFullscreen();
      };
    }

    // --- DEV MENU CONTROLS ---
    window.ATR.devSettings = {
      disableAiCarCollisions: false,
      disableAiEnvCollisions: false,
      infiniteTurbo: false
    };

    const devBtn = document.getElementById('dev-menu-btn');
    const devDropdown = document.getElementById('dev-menu-dropdown');
    const devContainer = document.getElementById('dev-menu-container');

    if (devBtn && devDropdown) {
      devBtn.onclick = (e) => {
        e.stopPropagation();
        devDropdown.classList.toggle('hidden');
      };

      document.addEventListener('click', (e) => {
        if (devContainer && !devContainer.contains(e.target)) {
          devDropdown.classList.add('hidden');
        }
      });
    }

    document.getElementById('dev-disable-ai-cars')?.addEventListener('change', (e) => {
      window.ATR.devSettings.disableAiCarCollisions = e.target.checked;
    });

    document.getElementById('dev-disable-ai-env')?.addEventListener('change', (e) => {
      window.ATR.devSettings.disableAiEnvCollisions = e.target.checked;
    });

    document.getElementById('dev-infinite-turbo')?.addEventListener('change', (e) => {
      window.ATR.devSettings.infiniteTurbo = e.target.checked;
    });

    const aiSelect = document.getElementById('menu-ai-count');
    if (aiSelect) {
      this.aiCount = parseInt(aiSelect.value, 10);
      aiSelect.addEventListener('change', (e) => {
        this.aiCount = parseInt(e.target.value, 10);
      });
    }

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

    // Clear / initialize particle system
    if (this.smokeSystem) {
      this.smokeSystem.clear();
    } else if (window.ATR.SmokeParticleSystem) {
      this.smokeSystem = new window.ATR.SmokeParticleSystem(this.scene);
      window.ATR.smokeSystem = this.smokeSystem;
    }

    // Generate circuit
    const generator = new window.ATR.TrackGenerator();
    const trackData = generator.generate(this.seed, 'MEDIUM', this.envType, 50);
    this.track = new window.ATR.Track(this.scene, trackData);
    this.initMinimapTrack();

    // Player 1
    this.player1 = new window.ATR.Car(this.scene, {
      name: 'PLAYER 1',
      isPlayer: true,
      playerNum: 1,
      color: 0xe62222,
      startT: 0.04,
      laneOffset: isSplit ? -0.35 : -0.2
    });
    this.allCars.push(this.player1);

    // Player 2
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

    // Configurable AI Competitors (Default 3)
    const aiSelectEl = document.getElementById('menu-ai-count');
    const selectedAi = aiSelectEl ? parseInt(aiSelectEl.value, 10) : this.aiCount;
    const maxAi = isSplit ? Math.min(selectedAi, 18) : selectedAi;
    const aiCount = mode === 'PRACTICE' ? 0 : maxAi;

    for (let i = 0; i < aiCount; i++) {
      const row = Math.floor(i / 2) + 1;
      const lane = (i % 2 === 0 ? 0.35 : -0.35);
      const startT = (0.04 - row * 0.007 + 1.0) % 1.0;
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

    // Compute initial car placement
    this.allCars.forEach(car => car.updatePhysics(0.001, this.track));

    // Align cameras
    this.snapCameraToCar(this.cameraP1, this.player1);
    if (this.player2) {
      this.snapCameraToCar(this.cameraP2, this.player2);
    }

    window.ATR.Audio.startEngines(isSplit);
    this.runCountdown();
    this.scaleGame();
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

  handleCarCollisions(delta) {
    const cars = this.allCars;
    const count = cars.length;

    for (let i = 0; i < count; i++) {
      const a = cars[i];
      for (let j = i + 1; j < count; j++) {
        const b = cars[j];

        // DEV: Skip collision if either car is AI and AI car collisions are disabled
        if (window.ATR?.devSettings?.disableAiCarCollisions && (!a.isPlayer || !b.isPlayer)) {
          continue;
        }

        const dist = a.mesh.position.distanceTo(b.mesh.position);
        if (dist < 2.8) {
          // Push cars apart sideways
          const laneDiff = a.laneOffset - b.laneOffset;
          const pushDir = Math.abs(laneDiff) > 0.04 ? Math.sign(laneDiff) : (Math.random() > 0.5 ? 1 : -1);
          a.laneOffset = Math.max(-1.25, Math.min(1.25, a.laneOffset + pushDir * 0.16));
          b.laneOffset = Math.max(-1.25, Math.min(1.25, b.laneOffset - pushDir * 0.16));

          // Impact penalty: slow down cars
          if (a.collisionCooldown <= 0 || b.collisionCooldown <= 0) {
            const slowFactor = 0.82; // 18% speed loss per collision
            a.speed = Math.max(0, a.speed * slowFactor);
            b.speed = Math.max(0, b.speed * slowFactor);

            a.collisionCooldown = 0.35;
            b.collisionCooldown = 0.35;

            // Audio & Camera Shake if player car involved
            if (a.isPlayer || b.isPlayer) {
              if (this.shakeIntensity < 0.85) this.shakeIntensity = 0.85;
              if (window.ATR.Audio) window.ATR.Audio.playCrash();
            }

            // Impact sparks / smoke
            if (window.ATR.smokeSystem) {
              const mid = a.mesh.position.clone().add(b.mesh.position).multiplyScalar(0.5);
              window.ATR.smokeSystem.emit({
                position: mid,
                velocity: new THREE.Vector3((Math.random() - 0.5) * 2.5, 1.2, (Math.random() - 0.5) * 2.5),
                startSize: 0.6,
                endSize: 2.0,
                startOpacity: 0.8,
                maxLife: 0.45,
                color: 0xffddaa
              });
            }
          }
        }
      }
    }
  }

  checkObstacleCollisions() {
    if (!this.track || !this.track.obstacles) return;

    for (let car of this.allCars) {
      // DEV: Skip hazard checks for AI if AI env collisions are disabled
      if (window.ATR?.devSettings?.disableAiEnvCollisions && !car.isPlayer) {
        continue;
      }

      for (let obs of this.track.obstacles) {
        const dist = car.mesh.position.distanceTo(obs.position);
        if (dist < obs.radius) {
          car.hitHazard(obs.type);
          if (car.isPlayer) {
            this.shakeIntensity = obs.type === 'OIL' ? 0.5 : 1.3;
          }
        }
      }
    }
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

    // Dynamically balance FOV so the track doesn't look zoomed-in on mobile aspects
    let baseFov = 70;
    if (aspect < 1.0) {
      baseFov = 92; // Mobile portrait
    } else if (aspect < 1.45) {
      baseFov = 78; // Compact/tablet screens
    }

    camera.fov = baseFov + speedRatio * 10.0;
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
    if (posEl) posEl.innerText = `${rank.toString().padStart(2, '0')}/${this.allCars.length.toString().padStart(2, '0')}`;

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
    const pad = 36; // Scaled proportionally for 560x560 canvas

    ctx.clearRect(0, 0, w, h);

    const { minX, maxX, minZ, maxZ } = this.minimapBounds;
    const spanX = maxX - minX || 1;
    const spanZ = maxZ - minZ || 1;

    const toMap = (x, z) => ({
      x: pad + ((x - minX) / spanX) * (w - pad * 2),
      y: pad + ((z - minZ) / spanZ) * (h - pad * 2)
    });

    // 1. Draw Track Ribbon (Scaled 2x for 560x560)
    ctx.beginPath();
    const first = toMap(this.minimapTrackPoints[0].x, this.minimapTrackPoints[0].z);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < this.minimapTrackPoints.length; i++) {
      const pt = toMap(this.minimapTrackPoints[i].x, this.minimapTrackPoints[i].z);
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.closePath();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.strokeStyle = 'rgba(70, 160, 240, 0.85)';
    ctx.lineWidth = 7;
    ctx.stroke();

    // 2. Start/Finish Line Indicator
    const finishPos = toMap(this.track.spline.getPointAt(0.01).x, this.track.spline.getPointAt(0.01).z);
    ctx.fillStyle = '#ff0055';
    ctx.beginPath();
    ctx.arc(finishPos.x, finishPos.y, 9, 0, Math.PI * 2);
    ctx.fill();

    // 3. AI Racers
    for (let i = 0; i < this.aiCars.length; i++) {
      const car = this.aiCars[i].car;
      const pos = toMap(car.mesh.position.x, car.mesh.position.z);
      ctx.fillStyle = 'rgba(210, 220, 230, 0.85)';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 6.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Player 2 (Cyan with white rim)
    if (this.player2) {
      const p2Pos = toMap(this.player2.mesh.position.x, this.player2.mesh.position.z);
      ctx.fillStyle = '#00c3ff';
      ctx.beginPath();
      ctx.arc(p2Pos.x, p2Pos.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // 5. Player 1 (Red with white rim)
    if (this.player1) {
      const p1Pos = toMap(this.player1.mesh.position.x, this.player1.mesh.position.z);
      ctx.fillStyle = '#ff2244';
      ctx.beginPath();
      ctx.arc(p1Pos.x, p1Pos.y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
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

    // Collision detection
    this.handleCarCollisions(delta);
    this.checkObstacleCollisions();

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
