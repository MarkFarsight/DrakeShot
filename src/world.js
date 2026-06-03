// ============================================================================
// WORLD  —  the voxel terrain
// ----------------------------------------------------------------------------
// Stores every block in one flat Uint8Array and renders the whole thing as a
// SINGLE merged mesh with face-culling (interior faces between two solid blocks
// are skipped). That keeps us at one draw call instead of thousands of cubes.
//
// Public API used by the rest of the game:
//   getBlock(x,y,z) / setBlock(x,y,z,id)   read & write a block
//   isSolidAt(x,y,z)                        collision query (used by the player)
//   rebuild()                               regenerate the mesh after edits
//   heightMap                               surface height per column (spawn use)
// ============================================================================


// The 6 faces of a cube. `corners` are ordered so the two triangles
// (0,1,2) and (2,1,3) wind counter-clockwise when viewed from outside.
// `shade` bakes a little flat lighting so cube edges read clearly.
const FACES = [
  { dir: [-1, 0, 0], shade: 0.80, corners: [[0, 1, 0], [0, 0, 0], [0, 1, 1], [0, 0, 1]] }, // -X left
  { dir: [ 1, 0, 0], shade: 0.80, corners: [[1, 1, 1], [1, 0, 1], [1, 1, 0], [1, 0, 0]] }, // +X right
  { dir: [ 0,-1, 0], shade: 0.55, corners: [[1, 0, 1], [0, 0, 1], [1, 0, 0], [0, 0, 0]] }, // -Y bottom
  { dir: [ 0, 1, 0], shade: 1.00, corners: [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]] }, // +Y top
  { dir: [ 0, 0,-1], shade: 0.68, corners: [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]] }, // -Z back
  { dir: [ 0, 0, 1], shade: 0.68, corners: [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]] }, // +Z front
];

class World {
  constructor(scene) {
    this.scene = scene;
    this.W = WORLD.SIZE_X;
    this.H = WORLD.MAX_HEIGHT;
    this.D = WORLD.SIZE_Z;
    this.blocks = new Uint8Array(this.W * this.H * this.D); // 0 = air everywhere
    this.heightMap = new Int16Array(this.W * this.D);
    this.mesh = null;
    this.edits = Object.create(null); // index -> id for blocks the player changed (for saving)

    this.generate();
    this.rebuild();
  }

  // --- indexing helpers ------------------------------------------------------
  idx(x, y, z) { return x + z * this.W + y * this.W * this.D; }

  inBounds(x, y, z) {
    return x >= 0 && x < this.W && y >= 0 && y < this.H && z >= 0 && z < this.D;
  }

  getBlock(x, y, z) {
    if (!this.inBounds(x, y, z)) return BLOCK.AIR;
    return this.blocks[this.idx(x, y, z)];
  }

  setBlock(x, y, z, id) {
    if (!this.inBounds(x, y, z)) return;
    this.blocks[this.idx(x, y, z)] = id;
  }

  // Like setBlock, but records the change so it can be saved/restored.
  // (Terrain generation uses setBlock, so generated blocks aren't counted.)
  editBlock(x, y, z, id) {
    if (!this.inBounds(x, y, z)) return;
    const i = this.idx(x, y, z);
    this.blocks[i] = id;
    this.edits[i] = id;
  }

  // Re-apply a saved set of edits (index -> id) over the freshly generated world.
  loadEdits(obj) {
    this.edits = Object.create(null);
    for (const k in obj) {
      const i = +k;
      this.blocks[i] = obj[k];
      this.edits[i] = obj[k];
    }
    this.rebuild();
  }

  // Wipe back to a fresh generated world (used by "New World").
  reset() {
    this.blocks.fill(0);
    this.edits = Object.create(null);
    this.generate();
    this.rebuild();
  }

  // Collision test. Below the world (y < 0) counts as solid floor so the player
  // can never fall out of the bottom. Outside the horizontal edges is open air.
  isSolidAt(x, y, z) {
    if (y < 0) return true;
    if (!this.inBounds(x, y, z)) return false;
    return isSolid(this.blocks[this.idx(x, y, z)]);
  }

  // --- terrain generation ----------------------------------------------------
  generate() {
    const noise = makeValueNoise(WORLD.SEED);
    for (let x = 0; x < this.W; x++) {
      for (let z = 0; z < this.D; z++) {
        // Two octaves of value noise -> gentle rolling hills.
        const n =
          0.7 * noise(x * WORLD.NOISE_SCALE, z * WORLD.NOISE_SCALE) +
          0.3 * noise(x * WORLD.NOISE_SCALE * 2.3, z * WORLD.NOISE_SCALE * 2.3);
        const h = Math.min(
          this.H - 6,
          Math.floor(WORLD.BASE_HEIGHT + n * WORLD.HILL_HEIGHT)
        );
        this.heightMap[x + z * this.W] = h;

        for (let y = 0; y <= h; y++) {
          let id;
          if (y === h) id = BLOCK.GRASS;
          else if (y >= h - WORLD.DIRT_DEPTH) id = BLOCK.DIRT;
          else id = BLOCK.STONE;
          this.blocks[this.idx(x, y, z)] = id;
        }
      }
    }

    // Scatter a few wood pillars so there is some wood to harvest later.
    const rnd = mulberry32(WORLD.SEED ^ 0x9e3779b9);
    for (let i = 0; i < WORLD.TREES; i++) {
      const x = 4 + Math.floor(rnd() * (this.W - 8));
      const z = 4 + Math.floor(rnd() * (this.D - 8));
      const h = this.heightMap[x + z * this.W];
      const trunk = 3 + Math.floor(rnd() * 3);
      for (let y = h + 1; y <= h + trunk && y < this.H; y++) {
        this.setBlock(x, y, z, BLOCK.WOOD);
      }
    }
  }

  // For meshing only: should we DRAW the face between a block and this neighbour?
  // We draw a face when the neighbour is NOT solid. Below the world is treated as
  // solid (so we never draw the underside of the world); the horizontal edges and
  // the top are open, so the world's outer walls and surface render normally.
  _neighbourSolidForMesh(x, y, z) {
    if (y < 0) return true;
    if (x < 0 || x >= this.W || z < 0 || z >= this.D || y >= this.H) return false;
    return isSolid(this.blocks[this.idx(x, y, z)]);
  }

  // --- (re)build the merged mesh --------------------------------------------
  rebuild() {
    const positions = [];
    const normals = [];
    const colors = [];
    const indices = [];
    const color = new THREE.Color();

    for (let y = 0; y < this.H; y++) {
      for (let z = 0; z < this.D; z++) {
        for (let x = 0; x < this.W; x++) {
          const id = this.blocks[this.idx(x, y, z)];
          if (id === BLOCK.AIR) continue;
          color.setHex(blockColor(id));

          for (const face of FACES) {
            const [dx, dy, dz] = face.dir;
            if (this._neighbourSolidForMesh(x + dx, y + dy, z + dz)) continue; // hidden face

            const base = positions.length / 3;
            for (const c of face.corners) {
              positions.push(x + c[0], y + c[1], z + c[2]);
              normals.push(dx, dy, dz);
              colors.push(color.r * face.shade, color.g * face.shade, color.b * face.shade);
            }
            indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
          }
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);

    if (!this.mesh) {
      const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
      this.mesh = new THREE.Mesh(geo, mat);
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;
      this.scene.add(this.mesh);
    } else {
      this.mesh.geometry.dispose();
      this.mesh.geometry = geo;
    }
  }
}
