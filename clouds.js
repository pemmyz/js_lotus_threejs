/* ===================================================
   AMIGA TURBO RACER - PROCEDURAL CLOUD SYSTEM
   Generates low-poly, multi-puff drifting clouds.
   =================================================== */

(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory(require('three'));
  } else {
    root.ATR = root.ATR || {};
    const mod = factory(root.THREE);
    root.ATR.createCloudSystem = mod.createCloudSystem;
  }
})(typeof self !== 'undefined' ? self : this, function (THREE) {

  /**
   * Creates a procedural, low-poly cloud system.
   * 
   * @param {Object} options Configuration options
   * @param {number} [options.count=30] - Number of cloud clusters to generate
   * @param {number} [options.baseAlt=175] - Minimum base altitude
   * @param {function} [options.getHeightAt=null] - Optional (x, z) => height function to prevent terrain clipping
   * @param {number} [options.minRadius=60] - Minimum spawn distance from world center
   * @param {number} [options.maxRadius=680] - Maximum spawn distance from world center
   * @param {number} [options.boundX=800] - Horizontal boundary where clouds wrap around
   * @param {number} [options.cloudColor=0xffffff] - Hex color of the clouds
   * @param {number} [options.opacity=0.42] - Material opacity
   */
  function createCloudSystem(options = {}) {
    const {
      count = 30,
      baseAlt = 175,
      getHeightAt = null,
      minRadius = 60,
      maxRadius = 680,
      boundX = 800,
      cloudColor = 0xffffff,
      opacity = 0.42
    } = options;

    const group = new THREE.Group();

    // Shared geometry and material for performance
    const puffGeo = new THREE.DodecahedronGeometry(1, 1);
    const cloudMat = new THREE.MeshLambertMaterial({
      color: cloudColor,
      transparent: true,
      opacity: opacity,
      depthWrite: false, // Prevents transparent sorting artifacts
      flatShading: true  // Gives the retro low-poly look
    });

    // Spawn cloud clusters
    for (let i = 0; i < count; i++) {
      const cluster = new THREE.Group();

      // Random circular distribution around the center
      const dist = minRadius + Math.random() * (maxRadius - minRadius);
      const ang = Math.random() * Math.PI * 2;
      const x = Math.cos(ang) * dist;
      const z = Math.sin(ang) * dist;

      // Calculate altitude ensuring it floats comfortably above the terrain
      const terrainH = getHeightAt ? getHeightAt(x, z) : 20;
      const altitude = Math.max(
        terrainH + 35 + Math.random() * 45,
        baseAlt + Math.random() * 85
      );
      cluster.position.set(x, altitude, z);

      // Build the puffy cluster from 4 to 8 overlapping dodecahedrons
      const numPuffs = 4 + Math.floor(Math.random() * 5);
      for (let p = 0; p < numPuffs; p++) {
        const puff = new THREE.Mesh(puffGeo, cloudMat);
        puff.position.set(
          (Math.random() - 0.5) * 2.2,
          (Math.random() - 0.5) * 0.7,
          (Math.random() - 0.5) * 1.8
        );
        puff.scale.set(
          1.0 + Math.random() * 1.4,
          0.6 + Math.random() * 0.5,
          1.0 + Math.random() * 1.2
        );
        cluster.add(puff);
      }

      // Overall size of the cloud cluster
      cluster.scale.setScalar(14 + Math.random() * 16);

      // Random drift speed per cloud
      cluster.userData = { driftSpeed: 0.6 + Math.random() * 0.8 };

      group.add(cluster);
    }

    /**
     * Call inside your animation loop (requestAnimationFrame).
     * @param {number} delta - Frame delta time in seconds (e.g. clock.getDelta())
     */
    function update(delta) {
      for (let i = 0; i < group.children.length; i++) {
        const cluster = group.children[i];
        cluster.position.x += cluster.userData.driftSpeed * delta * 2.0;

        // Wrap around when moving beyond the world boundary
        if (cluster.position.x > boundX) {
          cluster.position.x = -boundX;
        }
      }
    }

    /**
     * Cleans up geometries and materials when removing the clouds.
     */
    function dispose() {
      puffGeo.dispose();
      cloudMat.dispose();
      while (group.children.length > 0) {
        group.remove(group.children[0]);
      }
    }

    return {
      group,
      update,
      dispose
    };
  }

  return { createCloudSystem };
});
