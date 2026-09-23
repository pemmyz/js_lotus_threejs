/* ===================================================
   AMIGA TURBO RACER - PROCEDURAL CARS & VEHICLE PHYSICS
   Constructs 1990s wedge-shaped supercars with pop-up
   headlights, spoilers, shadows, and arcade physics
   supporting human players and 19 competing AI racers.
   =================================================== */

window.ATR = window.ATR || {};

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
    this.offRoad = false;

    // Visual steering angle state
    this.steerAngle = 0;
    this.steerYaw = 0;

    this.mesh = CarModelFactory.createWedgeCar(this.color, this.isPlayer);
    this.scene.add(this.mesh);
  }

  updatePhysics(delta, track) {
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

    this.mesh.position.copy(worldPos);
    this.mesh.position.y += this.altitude + 0.05;

    if (this.slipTime <= 0) {
      // Smoothly interpolate visual steering yaw and return toward center
      this.steerYaw = THREE.MathUtils.lerp(this.steerYaw || 0, this.steerAngle || 0, delta * 12);
      this.steerAngle = 0;

      // Flipped forward orientation with matching steering turn direction
      const lookTarget = this.mesh.position.clone()
        .sub(roadInfo.tangent)
        .addScaledVector(roadInfo.normal, -this.steerYaw * 0.4);

      this.mesh.lookAt(lookTarget);
    }

    this.updateLapCheckpoints(track);
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

window.ATR.CarModelFactory = CarModelFactory;
window.ATR.Car = Car;
window.ATR.AIController = AIController;
window.ATR.AMIGA_NAMES = AMIGA_NAMES;
window.ATR.AI_PALETTE = AI_PALETTE;
