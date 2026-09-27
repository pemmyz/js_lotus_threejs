/* ===================================================
   AMIGA TURBO RACER - PROCEDURAL CARS & VEHICLE PHYSICS
   Constructs 1990s wedge-shaped supercars with pop-up
   headlights, spoilers, shadows, and arcade physics
   supporting human players and 19 competing AI racers.
   =================================================== */

window.ATR = window.ATR || {};

/* ===================================================
   SMOKE PARTICLE SYSTEM
   High-performance pooled billboard particle system.
   Supports tire skid smoke and exhaust smoke trails.
   =================================================== */
class SmokeParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.maxParticles = 350;
    this.particles = [];
    this.poolIndex = 0;

    // Procedural soft-radial smoke puff texture
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.35, 'rgba(235, 240, 250, 0.85)');
    grad.addColorStop(0.7, 'rgba(195, 200, 215, 0.35)');
    grad.addColorStop(1, 'rgba(180, 185, 195, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fill();

    this.texture = new THREE.CanvasTexture(canvas);
    this.group = new THREE.Group();

    for (let i = 0; i < this.maxParticles; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.texture,
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      this.group.add(sprite);

      this.particles.push({
        sprite,
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1.0,
        startSize: 0.5,
        endSize: 2.0,
        startOpacity: 0.7,
        rotSpeed: 0
      });
    }

    this.scene.add(this.group);
  }

  emit(config) {
    const p = this.particles[this.poolIndex];
    this.poolIndex = (this.poolIndex + 1) % this.maxParticles;

    p.active = true;
    p.life = 0;
    p.maxLife = config.maxLife || 0.8;
    p.startSize = config.startSize || 0.5;
    p.endSize = config.endSize || 2.0;
    p.startOpacity = config.startOpacity !== undefined ? config.startOpacity : 0.7;
    p.pos.copy(config.position);
    p.vel.copy(config.velocity);
    p.rotSpeed = config.rotSpeed || (Math.random() - 0.5) * 2.0;

    p.sprite.position.copy(config.position);
    p.sprite.scale.set(p.startSize, p.startSize, 1.0);
    p.sprite.material.opacity = p.startOpacity;
    p.sprite.material.color.set(config.color !== undefined ? config.color : 0xffffff);
    p.sprite.material.rotation = Math.random() * Math.PI * 2;
    p.sprite.visible = true;
  }

  update(delta) {
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      p.life += delta;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.sprite.visible = false;
        continue;
      }

      const progress = p.life / p.maxLife;

      p.pos.addScaledVector(p.vel, delta);
      p.sprite.position.copy(p.pos);

      const currentSize = p.startSize + (p.endSize - p.startSize) * Math.sqrt(progress);
      p.sprite.scale.set(currentSize, currentSize, 1.0);
      p.sprite.material.opacity = p.startOpacity * (1.0 - progress * progress);
      p.sprite.material.rotation += p.rotSpeed * delta;
    }
  }

  clear() {
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles[i].active = false;
      this.particles[i].sprite.visible = false;
    }
  }
}

class CarModelFactory {
  static createWedgeCar(bodyColor = 0xff2222, isPlayer = false) {
    const carGroup = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.4, metalness: 0.1, flatShading: true });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x111115, roughness: 0.8, flatShading: true });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 0.2, metalness: 0.8, flatShading: true });

    // Chassis
    const chassisGeo = new THREE.BoxGeometry(2.2, 0.6, 4.4);
    const chassis = new THREE.Mesh(chassisGeo, bodyMat);
    chassis.position.y = 0.5;
    carGroup.add(chassis);

    // Sloped Nose (Front of car points to -Z)
    const noseGeo = new THREE.BufferGeometry();
    const noseVertices = new Float32Array([
      -1.1, 0.2, -2.2,   1.1, 0.2, -2.2,   1.1, 0.6, -1.2,
      -1.1, 0.2, -2.2,   1.1, 0.6, -1.2,  -1.1, 0.6, -1.2
    ]);
    noseGeo.setAttribute('position', new THREE.BufferAttribute(noseVertices, 3));
    noseGeo.computeVertexNormals();
    const nose = new THREE.Mesh(noseGeo, bodyMat);
    carGroup.add(nose);

    // Cockpit
    const roofGeo = new THREE.BoxGeometry(1.7, 0.5, 2.0);
    const roof = new THREE.Mesh(roofGeo, glassMat);
    roof.position.set(0, 0.95, -0.2);
    carGroup.add(roof);

    // Rear Spoiler (Back of car at +Z)
    const spoilerMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.4 });
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.1, 0.5), spoilerMat);
    wing.position.set(0, 1.15, 2.0);

    const post1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.12), trimMat);
    const post2 = post1.clone();
    post1.position.set(-0.9, 0.95, 2.0);
    post2.position.set(0.9, 0.95, 2.0);
    carGroup.add(wing, post1, post2);

    // Front Headlights (-Z)
    const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const headL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.1), headMat);
    const headR = headL.clone();
    headL.position.set(-0.7, 0.62, -2.15);
    headR.position.set(0.7, 0.62, -2.15);

    // Rear Tail Lights (+Z)
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
    const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.15, 0.1), tailMat);
    const tailR = tailL.clone();
    tailL.position.set(-0.7, 0.6, 2.21);
    tailR.position.set(0.7, 0.6, 2.21);
    carGroup.add(headL, headR, tailL, tailR);

    // Wheels
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9, flatShading: true });
    const rimMat = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.35, 8);
    wheelGeo.rotateZ(Math.PI / 2);

    const wheelPositions = [
      [-1.15, 0.38, -1.3], [1.15, 0.38, -1.3],
      [-1.15, 0.38, 1.3],  [1.15, 0.38, 1.3]
    ];

    wheelPositions.forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(pos[0], pos[1], pos[2]);
      const rim = new THREE.Mesh(new THREE.CircleGeometry(0.22, 6), rimMat);
      rim.rotation.y = pos[0] > 0 ? Math.PI / 2 : -Math.PI / 2;
      rim.position.set(pos[0] > 0 ? pos[0] + 0.18 : pos[0] - 0.18, pos[1], pos[2]);
      carGroup.add(wheel, rim);
    });

    // Blob Shadow
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.45, transparent: true });
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 4.8), shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.05;
    carGroup.add(shadow);

    return carGroup;
  }
}

class Car {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.name = options.name || 'Racer';
    this.isPlayer = !!options.isPlayer;
    this.playerNum = options.playerNum || 1;
    this.color = options.color || 0xe62222;

    // Fast Lotus-Era Arcade Physics
    this.speed = 0;
    this.maxSpeed = options.maxSpeed || 265.0; // Fast arcade supercar speed (KM/H)
    this.accel = options.accel || 65.0;
    this.braking = 90.0;
    this.drag = 0.992;
    this.steeringSensitivity = 2.0;

    this.trackT = options.startT || 0.0;
    this.laneOffset = options.laneOffset || 0.0;
    this.lap = 1;
    this.checkpointIndex = 0;
    this.finished = false;
    this.totalRaceDistance = 0;

    this.fuel = 100.0;
    this.turbo = 100.0;
    this.isTurboActive = false;

    this.airborne = false;
    this.altitude = 0;
    this.verticalVelocity = 0;
    this.slipTime = 0;
    this.hazardCooldown = 0;
    this.offRoad = false;

    // Visual steering angle state
    this.steerAngle = 0;
    this.steerYaw = 0;

    // Smoke emission timers
    this.tireSmokeTimer = 0;
    this.exhaustTimer = 0;

    this.mesh = CarModelFactory.createWedgeCar(this.color, this.isPlayer);
    this.scene.add(this.mesh);
  }

  updatePhysics(delta, track) {
    if (this.hazardCooldown > 0) {
      this.hazardCooldown -= delta;
    }

    if (this.altitude > 0 || this.verticalVelocity !== 0) {
      this.altitude += this.verticalVelocity * delta;
      this.verticalVelocity -= 22.0 * delta;
      if (this.altitude <= 0) {
        this.altitude = 0;
        this.verticalVelocity = 0;
      }
    }

    if (this.slipTime > 0) {
      this.slipTime -= delta;
      this.mesh.rotation.y += delta * 15.0;
    }

    this.offRoad = Math.abs(this.laneOffset) > 0.88;
    if (this.offRoad && !this.airborne) {
      this.speed *= (1.0 - 1.6 * delta); // Grass drag
    }

    this.speed *= Math.pow(this.drag, delta * 60);
    if (this.speed < 0) this.speed = 0;

    // Turbo boost allows exceeding standard top speed
    if (this.isTurboActive && this.turbo > 0) {
      this.turbo -= 24 * delta;
      this.speed = Math.min(this.speed + this.accel * 1.6 * delta, this.maxSpeed * 1.22); // Reaches ~323 KM/H
      if (this.turbo <= 0) this.isTurboActive = false;
    } else {
      this.turbo = Math.min(100, this.turbo + 4.5 * delta);
    }

    if (this.speed > 5) {
      this.fuel = Math.max(0, this.fuel - (delta * 0.45) * (this.speed / this.maxSpeed));
      if (this.fuel <= 0) this.speed *= 0.96;
    }

    // Advance position along spline
    const distanceDelta = (this.speed / 3.6) * delta;
    this.totalRaceDistance += distanceDelta;
    this.trackT = ((this.trackT + (distanceDelta / track.totalLength)) % 1.0 + 1.0) % 1.0;

    // Road alignment
    const roadInfo = track.getRoadTransformAt(this.trackT);
    const roadHalfWidth = track.roadWidth * 0.46;
    const worldPos = roadInfo.center.clone().addScaledVector(roadInfo.normal, this.laneOffset * roadHalfWidth);

    if (this.slipTime <= 0) {
      // Smoothly interpolate visual steering yaw and return toward center
      this.steerYaw = THREE.MathUtils.lerp(this.steerYaw || 0, this.steerAngle || 0, delta * 12);
      this.steerAngle = 0;

      // Inverted so rear swings outward (Right when steering Left, Left when steering Right)
      const swingOffset = -this.steerYaw * 0.45;
      const frontOffset = 1.6;

      // Anchor front of car to the road line
      const frontPoint = worldPos.clone().addScaledVector(roadInfo.tangent, frontOffset);

      // Swing the rear outward to the opposite side
      const rearDir = roadInfo.tangent.clone().negate().addScaledVector(roadInfo.normal, swingOffset).normalize();

      // Position car so the front stays anchored while the rear swings
      this.mesh.position.copy(frontPoint).addScaledVector(rearDir, frontOffset);
      this.mesh.position.y += this.altitude + 0.05;

      const lookTarget = this.mesh.position.clone().add(rearDir);
      this.mesh.lookAt(lookTarget);
    } else {
      this.mesh.position.copy(worldPos);
      this.mesh.position.y += this.altitude + 0.05;
    }

    this.updateLapCheckpoints(track);
    this.updateSmoke(delta, roadInfo);
  }

  updateSmoke(delta, roadInfo) {
    if (!window.ATR.smokeSystem) return;

    // Limit smoke generation for far-away AI cars to preserve high frame rates
    if (!this.isPlayer && window.gameApp && window.gameApp.player1) {
      const distSq = this.mesh.position.distanceToSquared(window.gameApp.player1.mesh.position);
      if (distSq > 140 * 140) return;
    }

    // Refresh world matrix so localToWorld accurately reflects current orientation & swing
    this.mesh.updateMatrixWorld(true);

    // 1. REAR WHEEL TIRE SMOKE WHEN TURNING
    const isTurning = Math.abs(this.steerYaw) > 0.08 || this.slipTime > 0;
    if (isTurning && this.speed > 8) {
      this.tireSmokeTimer += delta;
      const intensity = Math.min(1.0, Math.abs(this.steerYaw) * 1.5 + (this.slipTime > 0 ? 0.9 : 0));
      const interval = 0.045 / Math.max(0.6, intensity);

      if (this.tireSmokeTimer >= interval) {
        this.tireSmokeTimer = 0;

        // Both rear wheel contact patches: local X = -1.15 / 1.15, Y = 0.18, Z = 1.3
        const leftWheelPos = this.mesh.localToWorld(new THREE.Vector3(-1.15, 0.18, 1.3));
        const rightWheelPos = this.mesh.localToWorld(new THREE.Vector3(1.15, 0.18, 1.3));

        const rearDrift = roadInfo.tangent.clone().multiplyScalar(-this.speed * 0.07);

        // Left rear tire puff
        window.ATR.smokeSystem.emit({
          position: leftWheelPos.add(new THREE.Vector3((Math.random() - 0.5) * 0.2, 0, (Math.random() - 0.5) * 0.2)),
          velocity: new THREE.Vector3(
            rearDrift.x + (Math.random() - 0.5) * 0.6,
            0.6 + Math.random() * 0.6,
            rearDrift.z + (Math.random() - 0.5) * 0.6
          ),
          startSize: 0.45 + Math.random() * 0.2,
          endSize: 1.8 + Math.random() * 0.8,
          startOpacity: 0.7 + intensity * 0.2,
          maxLife: 0.75 + Math.random() * 0.35,
          color: 0xf5f7fa,
          rotSpeed: (Math.random() - 0.5) * 2.5
        });

        // Right rear tire puff
        window.ATR.smokeSystem.emit({
          position: rightWheelPos.add(new THREE.Vector3((Math.random() - 0.5) * 0.2, 0, (Math.random() - 0.5) * 0.2)),
          velocity: new THREE.Vector3(
            rearDrift.x + (Math.random() - 0.5) * 0.6,
            0.6 + Math.random() * 0.6,
            rearDrift.z + (Math.random() - 0.5) * 0.6
          ),
          startSize: 0.45 + Math.random() * 0.2,
          endSize: 1.8 + Math.random() * 0.8,
          startOpacity: 0.7 + intensity * 0.2,
          maxLife: 0.75 + Math.random() * 0.35,
          color: 0xf5f7fa,
          rotSpeed: (Math.random() - 0.5) * 2.5
        });
      }
    }

    // 2. EXHAUST SMOKE (STANDING STILL & WHILE MOVING)
    this.exhaustTimer += delta;
    const isStanding = this.speed < 4.0;
    const exhaustInterval = isStanding ? 0.13 : Math.max(0.025, 0.08 - (this.speed / this.maxSpeed) * 0.05);

    if (this.exhaustTimer >= exhaustInterval) {
      this.exhaustTimer = 0;

      // Twin exhaust pipes at rear bumper: local X = -0.45 or +0.45, Y = 0.35, Z = 2.25
      const pipeX = (Math.random() > 0.5 ? -0.45 : 0.45);
      const pipeWorld = this.mesh.localToWorld(new THREE.Vector3(pipeX, 0.32, 2.25));

      if (isStanding) {
        // Idle exhaust rising softly
        window.ATR.smokeSystem.emit({
          position: pipeWorld,
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 0.2,
            0.85 + Math.random() * 0.5,
            (Math.random() - 0.5) * 0.2
          ),
          startSize: 0.26,
          endSize: 1.1 + Math.random() * 0.4,
          startOpacity: 0.55,
          maxLife: 0.9 + Math.random() * 0.4,
          color: 0x8a929e,
          rotSpeed: (Math.random() - 0.5) * 1.5
        });
      } else {
        // Driving exhaust smoke stream behind car
        const backwardSpeed = Math.min(8.0, this.speed * 0.09);
        const exhaustBack = roadInfo.tangent.clone().multiplyScalar(-backwardSpeed);

        const isTurbo = this.isTurboActive;
        const puffColor = isTurbo ? 0x60a5fa : 0x7b8794;
        const puffLife = isTurbo ? 0.5 : 0.75 + Math.random() * 0.3;

        window.ATR.smokeSystem.emit({
          position: pipeWorld,
          velocity: new THREE.Vector3(
            exhaustBack.x + (Math.random() - 0.5) * 0.4,
            0.45 + Math.random() * 0.5,
            exhaustBack.z + (Math.random() - 0.5) * 0.4
          ),
          startSize: isTurbo ? 0.42 : 0.3,
          endSize: isTurbo ? 2.1 : 1.5 + Math.random() * 0.5,
          startOpacity: isTurbo ? 0.75 : 0.5,
          maxLife: puffLife,
          color: puffColor,
          rotSpeed: (Math.random() - 0.5) * 2.0
        });
      }
    }
  }

  updateLapCheckpoints(track) {
    const cpCount = track.checkpoints.length;
    const nextCpIdx = (this.checkpointIndex + 1) % cpCount;
    const nextCp = track.checkpoints[nextCpIdx];

    const distToCp = this.mesh.position.distanceTo(nextCp.point);
    if (distToCp < 35.0) {
      this.checkpointIndex = nextCpIdx;
      if (this.checkpointIndex === 0) {
        this.lap++;
      }
    }
  }

  steer(amount, delta) {
    if (this.speed < 2) return;
    const slipFactor = this.slipTime > 0 ? 0.25 : 1.0;
    this.laneOffset += amount * this.steeringSensitivity * slipFactor * delta;
    this.laneOffset = Math.max(-1.3, Math.min(1.3, this.laneOffset));
    this.steerAngle = amount; // Track turning input
  }

  accelerate(delta) {
    if (this.fuel <= 0) return;
    // Progressive power band: quick initial launch, gradual top-end pull up to 265 KM/H
    const speedRatio = Math.min(1.0, this.speed / this.maxSpeed);
    const progressiveAccel = this.accel * (1.0 - Math.pow(speedRatio, 1.8) * 0.72);
    this.speed = Math.min(this.speed + progressiveAccel * delta, this.maxSpeed);
  }

  brake(delta) {
    this.speed = Math.max(0, this.speed - this.braking * delta);
  }

  activateTurbo() {
    if (this.turbo > 20 && !this.isTurboActive) {
      this.isTurboActive = true;
      if (window.ATR.Audio) window.ATR.Audio.playTurbo();
    }
  }

  hitHazard(type) {
    if (type === 'OIL') {
      this.slipTime = 0.8;
      if (window.ATR.Audio) window.ATR.Audio.playSkid();
    } else if (type === 'LOG' || type === 'ROCK') {
      if (this.hazardCooldown > 0) return;
      this.hazardCooldown = 0.9;
      // Heavy arcade crash penalty and bounce
      this.speed = Math.max(0, this.speed * 0.28);
      this.verticalVelocity = 4.5;
      this.altitude = 0.3;
      if (window.ATR.Audio) window.ATR.Audio.playCrash();
    }
  }
}

class AIController {
  constructor(car, track, skill = 1.0) {
    this.car = car;
    this.track = track;
    this.skill = skill;
    this.targetLane = car.laneOffset;
    this.laneChangeTimer = Math.random() * 3;
    // High AI competitive speeds (225 - 265 KM/H)
    this.desiredSpeed = car.maxSpeed * (0.86 + Math.random() * 0.15);
  }

  update(delta, allCars) {
    if (this.car.speed < this.desiredSpeed) {
      this.car.accelerate(delta);
    } else {
      this.car.speed *= 0.995;
    }

    this.laneChangeTimer -= delta;
    if (this.laneChangeTimer <= 0) {
      this.laneChangeTimer = 2.0 + Math.random() * 3.5;
      this.targetLane = (Math.random() * 1.4 - 0.7);
    }

    // AI Obstacle Avoidance for half-road blocks and logs
    if (this.track && this.track.obstacles) {
      for (let obs of this.track.obstacles) {
        if (obs.type === 'LOG' || obs.type === 'ROCK') {
          const dist = this.car.mesh.position.distanceTo(obs.position);
          if (dist < 32.0) {
            if (obs.side === -1 && this.targetLane < 0.2) {
              this.targetLane = 0.6;
            } else if (obs.side === 1 && this.targetLane > -0.2) {
              this.targetLane = -0.6;
            }
          }
        }
      }
    }

    for (let other of allCars) {
      if (other === this.car) continue;
      const dist = this.car.mesh.position.distanceTo(other.mesh.position);
      if (dist < 14.0) {
        if (other.laneOffset > this.car.laneOffset) {
          this.targetLane = Math.max(-0.75, this.car.laneOffset - 0.4);
        } else {
          this.targetLane = Math.min(0.75, this.car.laneOffset + 0.4);
        }
      }
    }

    const diff = this.targetLane - this.car.laneOffset;
    if (Math.abs(diff) > 0.05) {
      this.car.steer(Math.sign(diff) * 0.85, delta);
    }

    this.car.updatePhysics(delta, this.track);
  }
}

const AMIGA_NAMES = [
  'Ayrton Sendit', 'Nige Fastmail', 'Alain Fullsend', 'Michael Brakeless',
  'Ricky Roadster', 'Jean Slip', 'Gerhard Gearbox', 'Nelson Piqued',
  'Johnny Overtake', 'Mika Flatout', 'Damon Hillclimb', 'Rubens Revs',
  'Eddie Sideway', 'Keke Apex', 'Mario Drift', 'Gilles Turbofan',
  'Jacques Chicane', 'Carlos Slipstream', 'Timo Speed'
];

const AI_PALETTE = [
  0xf5ee2a, 0x2ec4b6, 0xffffff, 0x9b5de5, 0xf15bb5,
  0x00bbf9, 0x00f5d4, 0xfee440, 0xf77f00, 0xd62828,
  0x80ed99, 0x57cc99, 0x38a3a5, 0x22577a, 0xc77dff
];

window.ATR.SmokeParticleSystem = SmokeParticleSystem;
window.ATR.CarModelFactory = CarModelFactory;
window.ATR.Car = Car;
window.ATR.AIController = AIController;
window.ATR.AMIGA_NAMES = AMIGA_NAMES;
window.ATR.AI_PALETTE = AI_PALETTE;
