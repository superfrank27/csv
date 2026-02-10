import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x78b8ff);
scene.fog = new THREE.Fog(0x9bc8ff, 120, 700);

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 1200);
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xdff2ff, 0x4b7f4b, 1.15));
const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.position.set(180, 300, 100);
scene.add(sun);

const ui = {
  menu: document.getElementById('menu'),
  gameOver: document.getElementById('gameOver'),
  finalCoins: document.getElementById('finalCoins'),
  health: document.getElementById('health'),
  coins: document.getElementById('coins'),
  armor: document.getElementById('armor'),
  weapon: document.getElementById('weapon'),
  ammo: document.getElementById('ammo'),
  corn: document.getElementById('corn'),
  villagers: document.getElementById('villagers'),
  animals: document.getElementById('animals'),
  hint: document.getElementById('hint'),
  shopPanel: document.getElementById('shopPanel'),
  shopList: document.getElementById('shopList')
};

const state = {
  started: false,
  dead: false,
  health: 10,
  coins: 0,
  armor: 0,
  corn: 18,
  weapon: 'sword',
  ammo: { pistol: 0, rifle: 0 },
  shopOpen: false,
  shopIndex: 0,
  lastAttackAt: 0,
  dayTimer: 0,
  cropTimer: 0,
  wallAutoRepairCheck: 0,
  reproductionTimer: 0,
  animalBreedTimer: 0
};

const keys = { w: false, a: false, s: false, d: false, space: false, shift: false };
const player = { pos: new THREE.Vector3(0, 3, 50), velY: 0, yaw: 0, grounded: true };

const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshLambertMaterial({ color: 0x4fa24f }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const mountains = new THREE.Group();
for (let i = 0; i < 30; i += 1) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(30 + Math.random() * 35, 50 + Math.random() * 80, 4), new THREE.MeshLambertMaterial({ color: 0x547a54 }));
  const a = (i / 30) * Math.PI * 2;
  const r = 420 + Math.random() * 140;
  m.position.set(Math.cos(a) * r, 25, Math.sin(a) * r);
  m.rotation.y = Math.random() * Math.PI;
  mountains.add(m);
}
scene.add(mountains);

function createTree(x, z) {
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(2, 14, 2), new THREE.MeshLambertMaterial({ color: 0x734d2a }));
  trunk.position.set(x, 7, z);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(8, 7, 8), new THREE.MeshLambertMaterial({ color: 0x2f7f2f }));
  leaf.position.set(x, 14, z);
  scene.add(trunk, leaf);
}
for (let i = 0; i < 180; i += 1) {
  const x = (Math.random() - 0.5) * 1000;
  const z = (Math.random() - 0.5) * 1000;
  if (Math.abs(x) < 120 && Math.abs(z) < 120) continue;
  createTree(x, z);
}

const village = new THREE.Group();
scene.add(village);

function makeHouse(x, z, c = 0xb87a45) {
  const base = new THREE.Mesh(new THREE.BoxGeometry(22, 12, 18), new THREE.MeshLambertMaterial({ color: c }));
  base.position.set(x, 6, z);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(24, 4, 20), new THREE.MeshLambertMaterial({ color: 0x9c3d3d }));
  roof.position.set(x, 14, z);
  village.add(base, roof);
}
makeHouse(-45, -20); makeHouse(45, -20); makeHouse(0, 42);

const shopBuilding = new THREE.Mesh(new THREE.BoxGeometry(18, 10, 14), new THREE.MeshLambertMaterial({ color: 0x4d7cae }));
shopBuilding.position.set(0, 5, -48);
village.add(shopBuilding);

const vendor = new THREE.Group();
const vb = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.2, 1), new THREE.MeshLambertMaterial({ color: 0x3d5f9c }));
const vh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xe0b991 }));
vb.position.y = 1.1; vh.position.y = 2.8; vendor.add(vb, vh); vendor.position.set(0, 0, -35); village.add(vendor);

// Farm: one plot with 9 corn slots.
const farmSlots = [];
for (let i = 0; i < 9; i += 1) {
  const row = Math.floor(i / 3), col = i % 3;
  const soil = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.4, 4.5), new THREE.MeshLambertMaterial({ color: 0x7a5b30 }));
  soil.position.set(-16 + col * 5, 0.2, -2 + row * 5);
  village.add(soil);
  const corn = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.1, 0.5), new THREE.MeshLambertMaterial({ color: 0xd9c744 }));
  corn.position.set(soil.position.x, 1.2, soil.position.z);
  corn.visible = false;
  village.add(corn);
  farmSlots.push({ grown: false, corn });
}

// Walls with hp = 3 per section
const walls = [];
function addWallSegment(x, z, sx, sz) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, 4, sz), new THREE.MeshLambertMaterial({ color: 0xb9a274 }));
  mesh.position.set(x, 2, z);
  village.add(mesh);
  walls.push({ mesh, hp: 3, broken: false, repairProgress: 0 });
}
for (let x = -75; x <= 75; x += 15) { addWallSegment(x, -75, 14, 2); addWallSegment(x, 75, 14, 2); }
for (let z = -60; z <= 60; z += 15) { addWallSegment(-75, z, 2, 14); addWallSegment(75, z, 2, 14); }

const villagers = [];
function spawnVillager(pos, age = 0, sex = Math.random() > 0.5 ? 'M' : 'F', isChild = false) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.1, 0.9), new THREE.MeshLambertMaterial({ color: isChild ? 0x7fbb7f : 0x8c6b53 }));
  const h = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), new THREE.MeshLambertMaterial({ color: 0xd5b38d }));
  b.position.y = isChild ? 0.8 : 1.1; h.position.y = isChild ? 1.9 : 2.8;
  g.add(b, h);
  g.position.copy(pos);
  village.add(g);
  villagers.push({ mesh: g, hp: 4, sex, isChild, adultAgeProgress: 0, ageEatenCorn: age, target: pos.clone(), repairing: false, mateCooldown: 0 });
}
for (let i = 0; i < 6; i += 1) spawnVillager(new THREE.Vector3(-10 + i * 4, 0, 20));

const animals = [];
function spawnAnimal(type, pos) {
  const g = new THREE.Group();
  const color = type === 'pig' ? 0xf0a3b2 : 0xf3f3f3;
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 0.9), new THREE.MeshLambertMaterial({ color }));
  b.position.y = 0.6;
  const h = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshLambertMaterial({ color }));
  h.position.set(1, 0.8, 0);
  g.add(b, h); g.position.copy(pos); village.add(g);
  animals.push({ type, mesh: g, hp: 2, outside: false, age: 0, breedTimer: 0 });
}
spawnAnimal('pig', new THREE.Vector3(20, 0, 10));
spawnAnimal('pig', new THREE.Vector3(23, 0, 12));
spawnAnimal('sheep', new THREE.Vector3(18, 0, 16));

// Player model (third-person visible)
const playerMesh = new THREE.Group();
const pb = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.3, 1), new THREE.MeshLambertMaterial({ color: 0x4062aa }));
const ph = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xdcb991 }));
pb.position.y = 1.1; ph.position.y = 2.8; playerMesh.add(pb, ph); scene.add(playerMesh);
const armorMesh = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.7, 1.2), new THREE.MeshLambertMaterial({ color: 0x9fb2c4 }));
armorMesh.position.y = 1.35; armorMesh.visible = false; playerMesh.add(armorMesh);
const weaponMesh = new THREE.Group(); weaponMesh.position.set(0.9, 1.2, 0); playerMesh.add(weaponMesh);

function drawWeapon() {
  weaponMesh.clear();
  if (state.weapon === 'sword') {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.15), new THREE.MeshLambertMaterial({ color: 0x654020 }));
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.15), new THREE.MeshLambertMaterial({ color: 0xd0d0d0 }));
    h.position.y = -0.2; b.position.y = 0.75; weaponMesh.add(h, b);
  } else if (state.weapon === 'pistol') {
    weaponMesh.add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.2), new THREE.MeshLambertMaterial({ color: 0x333 }))); 
  } else {
    weaponMesh.add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 0.2), new THREE.MeshLambertMaterial({ color: 0x444 }))); 
  }
}
drawWeapon();

// Zombies + tombs
const tombs = [new THREE.Vector3(0, 0, -330), new THREE.Vector3(330, 0, 0), new THREE.Vector3(-330, 0, 0), new THREE.Vector3(0, 0, 330)];
const zombies = [];
const zombieParts = new Map();
for (const t of tombs) {
  const tomb = new THREE.Mesh(new THREE.BoxGeometry(18, 8, 12), new THREE.MeshLambertMaterial({ color: 0x6e6464 }));
  tomb.position.set(t.x, 4, t.z);
  scene.add(tomb);
}
function spawnZombie(fromTomb) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.3, 1), new THREE.MeshLambertMaterial({ color: 0x2f9a45 }));
  const head = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0x5bc86b }));
  body.position.y = 1.1; head.position.y = 2.8;
  g.add(body, head);
  g.position.copy(fromTomb).add(new THREE.Vector3((Math.random() - 0.5) * 10, 0, (Math.random() - 0.5) * 10));
  scene.add(g);
  const z = { mesh: g, body, head, hp: 3, speed: 2 + Math.random() * 0.8, attackCd: 0, wallCd: 0 };
  zombieParts.set(body.uuid, { z, part: 'body' }); zombieParts.set(head.uuid, { z, part: 'head' }); zombies.push(z);
}
let zombieSpawnTicker = 0;

const bullets = [];
const raycaster = new THREE.Raycaster();

const SHOP_ITEMS = [
  { key: 'pistol', label: '手枪+100发', cost: 60 },
  { key: 'rifle', label: '步枪+100发', cost: 120 },
  { key: 'smallMed', label: '小药+5血', cost: 20 },
  { key: 'bigMed', label: '大药+10血', cost: 50 },
  { key: 'armor', label: '盔甲+1防御', cost: 500 },
  { key: 'pig', label: '500玉米换1猪（围墙完好）', costCorn: 500 },
  { key: 'sheep', label: '1000玉米换1羊（围墙完好）', costCorn: 1000 }
];

function playTone(freq, dur = 0.09, type = 'square', vol = 0.06) {
  const ctx = playTone.ctx || (playTone.ctx = new (window.AudioContext || window.webkitAudioContext)());
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type; o.frequency.value = freq; g.gain.value = vol;
  o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + dur);
}

function setHint(t) { ui.hint.textContent = t; setTimeout(() => { if (ui.hint.textContent === t) ui.hint.textContent = '-'; }, 700); }

function updateHud() {
  ui.health.textContent = String(state.health);
  ui.coins.textContent = String(state.coins);
  ui.armor.textContent = String(state.armor);
  ui.weapon.textContent = state.weapon === 'sword' ? '刀剑' : state.weapon === 'pistol' ? '手枪' : '步枪';
  ui.ammo.textContent = state.weapon === 'sword' ? '∞' : String(state.ammo[state.weapon]);
  ui.corn.textContent = String(Math.floor(state.corn));
  ui.villagers.textContent = String(villagers.length);
  ui.animals.textContent = String(animals.length);
  armorMesh.visible = state.armor > 0;
}

function killZombie(z) {
  zombieParts.delete(z.body.uuid); zombieParts.delete(z.head.uuid);
  scene.remove(z.mesh); zombies.splice(zombies.indexOf(z), 1);
  state.coins += 1; updateHud();
}

function shootBullet() {
  const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, player.yaw, 0));
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffdd66 }));
  m.position.copy(playerMesh.position).add(new THREE.Vector3(0, 1.8, 0)).addScaledVector(dir, 1.5);
  scene.add(m);
  bullets.push({ mesh: m, vel: dir.multiplyScalar(state.weapon === 'rifle' ? 120 : 90), life: 2 });
  playTone(300, 0.05, 'sawtooth', 0.07);
}

function meleeSwing() {
  weaponMesh.rotation.z = -0.9;
  setTimeout(() => { weaponMesh.rotation.z = 0; }, 120);
  playTone(170, 0.09, 'triangle');
  for (const z of [...zombies]) {
    if (z.mesh.position.distanceTo(playerMesh.position) < 4.2) {
      z.hp -= 1;
      if (z.hp <= 0) killZombie(z);
    }
  }
}

function attack() {
  if (!state.started || state.dead || state.shopOpen) return;
  const now = performance.now();
  const cd = state.weapon === 'sword' ? 330 : state.weapon === 'pistol' ? 220 : 130;
  if (now - state.lastAttackAt < cd) return;
  state.lastAttackAt = now;

  if (state.weapon === 'sword') {
    meleeSwing();
    return;
  }
  if (state.ammo[state.weapon] <= 0) {
    state.weapon = 'sword';
    drawWeapon();
    setHint('弹药耗尽，自动切回刀剑');
    updateHud();
    return;
  }
  state.ammo[state.weapon] -= 1;
  shootBullet();
  updateHud();
}

function anyWallBroken() { return walls.some((w) => w.broken); }
function wallHealthy() { return walls.every((w) => !w.broken); }

function openShop() {
  if (playerMesh.position.distanceTo(vendor.getWorldPosition(new THREE.Vector3())) > 10) {
    setHint('请靠近商店老板再按 B');
    return;
  }
  state.shopOpen = true;
  ui.shopPanel.classList.remove('hidden');
  renderShop();
}
function closeShop() { state.shopOpen = false; ui.shopPanel.classList.add('hidden'); }

function renderShop() {
  ui.shopList.innerHTML = '';
  SHOP_ITEMS.forEach((it, i) => {
    const li = document.createElement('li');
    li.textContent = `${it.label} - ${it.cost ? `${it.cost}金币` : `${it.costCorn}玉米`}`;
    if (i === state.shopIndex) li.classList.add('active');
    ui.shopList.appendChild(li);
  });
}

function buyCurrent() {
  const it = SHOP_ITEMS[state.shopIndex];
  const fail = (m) => setHint(m);
  if (it.cost && state.coins < it.cost) return fail('金币不足');
  if (it.costCorn && state.corn < it.costCorn) return fail('玉米不足');
  if ((it.key === 'pig' || it.key === 'sheep') && !wallHealthy()) return fail('围墙破损，不能购买家畜');

  if (it.cost) state.coins -= it.cost;
  if (it.costCorn) state.corn -= it.costCorn;

  if (it.key === 'pistol' || it.key === 'rifle') { state.weapon = it.key; state.ammo[it.key] += 100; drawWeapon(); }
  if (it.key === 'smallMed') state.health = Math.min(10, state.health + 5);
  if (it.key === 'bigMed') state.health = Math.min(10, state.health + 10);
  if (it.key === 'armor') state.armor += 1;
  if (it.key === 'pig') spawnAnimal('pig', new THREE.Vector3(15 + Math.random() * 8, 0, 8));
  if (it.key === 'sheep') spawnAnimal('sheep', new THREE.Vector3(20 + Math.random() * 8, 0, 10));

  playTone(520, 0.07, 'square', 0.05);
  updateHud(); renderShop();
}

function convertVillagerToZombie(v) {
  const pos = v.mesh.position.clone();
  village.remove(v.mesh);
  villagers.splice(villagers.indexOf(v), 1);
  spawnZombie(pos);
}

function updateVillage(dt) {
  // crop growth every 60s
  state.cropTimer += dt;
  if (state.cropTimer >= 60) {
    state.cropTimer = 0;
    farmSlots.forEach((s) => { s.grown = true; s.corn.visible = true; });
    setHint('菜地成熟了一批玉米');
  }

  // villagers collect corn and consume corn
  state.dayTimer += dt;
  if (state.dayTimer >= 60) {
    state.dayTimer = 0;
    villagers.forEach((v) => {
      if (!v.isChild) {
        if (state.corn > 0) { state.corn -= 1; v.ageEatenCorn += 1; }
        if (v.ageEatenCorn >= 100) {
          village.remove(v.mesh);
          villagers.splice(villagers.indexOf(v), 1);
        }
      } else if (state.corn > 0) {
        state.corn -= 1; v.adultAgeProgress += 1;
        if (v.adultAgeProgress >= 100) { v.isChild = false; v.sex = Math.random() > 0.5 ? 'M' : 'F'; }
      }
    });

    animals.forEach((a) => { if (state.corn > 0) state.corn -= 1; a.age += 1; a.breedTimer += 1; });
    for (let i = 0; i < animals.length - 1; i += 1) {
      const a = animals[i];
      const b = animals[i + 1];
      if (a.type === b.type && a.breedTimer >= 100 && b.breedTimer >= 100) {
        a.breedTimer = 0; b.breedTimer = 0;
        spawnAnimal(a.type, a.mesh.position.clone().add(new THREE.Vector3(1, 0, 1)));
      }
    }
  }

  // collect grown corns one-by-one
  villagers.forEach((v) => {
    if (anyWallBroken()) return;
    const grown = farmSlots.find((s) => s.grown);
    if (grown && Math.random() < 0.01) {
      grown.grown = false; grown.corn.visible = false; state.corn += 1;
    }
  });

  // reproduction: 100 corn => pair, after 10m spawn child
  state.reproductionTimer += dt;
  if (state.reproductionTimer >= 600) {
    state.reproductionTimer = 0;
    const male = villagers.find((v) => !v.isChild && v.sex === 'M');
    const female = villagers.find((v) => !v.isChild && v.sex === 'F');
    if (male && female && state.corn >= 100) {
      state.corn -= 100;
      spawnVillager(new THREE.Vector3(0, 0, 35), 0, 'M', true);
      setHint('村里新增了一个小孩');
    }
  }

  // villagers run/repair
  const danger = zombies.some((z) => z.mesh.position.length() < 110);
  villagers.forEach((v) => {
    const nearest = zombies.reduce((n, z) => {
      const d = z.mesh.position.distanceTo(v.mesh.position);
      return !n || d < n.d ? { z, d } : n;
    }, null);

    if (nearest && nearest.d < 20) {
      const flee = v.mesh.position.clone().sub(nearest.z.mesh.position).setY(0).normalize();
      v.mesh.position.addScaledVector(flee, dt * 2.8);
      v.repairing = false;
    } else if (!danger) {
      const broken = walls.find((w) => w.broken);
      if (broken) {
        const dir = broken.mesh.position.clone().sub(v.mesh.position).setY(0);
        if (dir.length() > 2) v.mesh.position.addScaledVector(dir.normalize(), dt * 2.0);
        else { broken.repairProgress += dt; v.repairing = true; }
      } else {
        v.repairing = false;
        if (Math.random() < 0.01) v.target = new THREE.Vector3((Math.random() - 0.5) * 80, 0, (Math.random() - 0.5) * 80);
        const dir = v.target.clone().sub(v.mesh.position).setY(0);
        if (dir.length() > 1) v.mesh.position.addScaledVector(dir.normalize(), dt * 1.5);
      }
    }
  });

  walls.forEach((w) => {
    if (w.broken && w.repairProgress >= 6) {
      w.broken = false; w.hp = 3; w.repairProgress = 0; w.mesh.visible = true;
      setHint('村民修好了一段围墙');
    }
  });
}

function updateAnimals(dt) {
  const broken = anyWallBroken();
  for (const a of [...animals]) {
    const nearestZ = zombies.reduce((n, z) => {
      const d = z.mesh.position.distanceTo(a.mesh.position);
      return !n || d < n.d ? { z, d } : n;
    }, null);
    if (nearestZ && nearestZ.d < 16) {
      const flee = a.mesh.position.clone().sub(nearestZ.z.mesh.position).setY(0).normalize();
      a.mesh.position.addScaledVector(flee, dt * 3.2);
      if (broken) a.outside = true;
    } else {
      a.mesh.position.x += (Math.random() - 0.5) * dt * 1.5;
      a.mesh.position.z += (Math.random() - 0.5) * dt * 1.5;
    }

    for (const z of zombies) {
      if (z.mesh.position.distanceTo(a.mesh.position) < 1.5) {
        a.hp -= dt * 1.5;
        if (a.hp <= 0) {
          z.hp = Math.min(5, z.hp + 1);
          village.remove(a.mesh);
          animals.splice(animals.indexOf(a), 1);
          break;
        }
      }
    }
  }
}

function updateZombies(dt) {
  zombieSpawnTicker += dt;
  if (zombieSpawnTicker > 3.5) {
    zombieSpawnTicker = 0;
    spawnZombie(tombs[Math.floor(Math.random() * tombs.length)]);
  }

  for (const z of [...zombies]) {
    // decide target: nearest villager then player
    let target = playerMesh.position;
    let best = z.mesh.position.distanceTo(playerMesh.position);
    for (const v of villagers) {
      const d = z.mesh.position.distanceTo(v.mesh.position);
      if (d < best) { best = d; target = v.mesh.position; }
    }
    const dir = target.clone().sub(z.mesh.position).setY(0);

    // attack walls
    const nearWall = walls.find((w) => !w.broken && z.mesh.position.distanceTo(w.mesh.position) < 2.2);
    if (nearWall) {
      z.wallCd -= dt;
      if (z.wallCd <= 0) {
        nearWall.hp -= 1;
        z.wallCd = 1;
        playTone(95, 0.06, 'square', 0.03);
        if (nearWall.hp <= 0) {
          nearWall.broken = true;
          nearWall.mesh.visible = false;
          setHint('围墙被僵尸打破了！');
        }
      }
      continue;
    }

    if (dir.length() > 1.1) {
      z.mesh.position.addScaledVector(dir.normalize(), z.speed * dt);
      z.mesh.lookAt(target.x, z.mesh.position.y, target.z);
    } else {
      z.attackCd -= dt;
      if (z.attackCd <= 0) {
        if (target === playerMesh.position) {
          const dmg = Math.max(0, 2 - state.armor);
          state.health -= dmg;
          if (state.health <= 0) {
            state.dead = true;
            ui.finalCoins.textContent = String(state.coins);
            ui.gameOver.classList.remove('hidden');
          }
        } else {
          const victim = villagers.find((v) => v.mesh.position === target);
          if (victim) {
            victim.hp -= 2;
            if (victim.hp <= 0) convertVillagerToZombie(victim);
          }
        }
        z.attackCd = 0.9;
      }
    }
  }
}

function updateBullets(dt) {
  for (const b of [...bullets]) {
    b.mesh.position.addScaledVector(b.vel, dt);
    b.life -= dt;
    raycaster.set(b.mesh.position, b.vel.clone().normalize());
    const hits = raycaster.intersectObjects(zombies.flatMap((z) => [z.body, z.head]), false);
    if (hits.length && hits[0].distance < 1.2) {
      const info = zombieParts.get(hits[0].object.uuid);
      if (info) {
        if (info.part === 'head') killZombie(info.z);
        else {
          info.z.hp -= state.weapon === 'rifle' ? 2 : 1;
          if (info.z.hp <= 0) killZombie(info.z);
        }
      }
      b.life = 0;
    }
    if (b.life <= 0) {
      scene.remove(b.mesh);
      bullets.splice(bullets.indexOf(b), 1);
    }
  }
}

function updatePlayer(dt) {
  const fwd = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw) * -1);
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).multiplyScalar(-1);
  const move = new THREE.Vector3();
  if (keys.w) move.add(fwd);
  if (keys.s) move.sub(fwd);
  if (keys.a) move.sub(right);
  if (keys.d) move.add(right);
  if (move.lengthSq() > 0) move.normalize();
  const speed = keys.shift ? 9 : 6;
  player.pos.addScaledVector(move, speed * dt);

  if (keys.space && player.grounded) { player.velY = 8.5; player.grounded = false; }
  player.velY -= 18 * dt;
  player.pos.y += player.velY * dt;
  if (player.pos.y <= 3) { player.pos.y = 3; player.velY = 0; player.grounded = true; }

  player.pos.x = THREE.MathUtils.clamp(player.pos.x, -550, 550);
  player.pos.z = THREE.MathUtils.clamp(player.pos.z, -550, 550);

  playerMesh.position.copy(player.pos).setY(player.pos.y - 3);
  playerMesh.rotation.y = player.yaw;

  const camOffset = new THREE.Vector3(0, 8, 14).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw);
  camera.position.copy(player.pos.clone().add(camOffset));
  camera.lookAt(player.pos.x, player.pos.y + 1.8, player.pos.z);
}

function tryHitAnimal() {
  for (const a of [...animals]) {
    if (a.mesh.position.distanceTo(playerMesh.position) < 4) {
      a.hp -= 1;
      if (a.hp <= 0) {
        village.remove(a.mesh);
        animals.splice(animals.indexOf(a), 1);
        state.health = Math.min(10, state.health + 1);
        setHint('击杀动物，恢复1点生命');
      }
      break;
    }
  }
}

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'w') keys.w = true; if (k === 'a') keys.a = true; if (k === 's') keys.s = true; if (k === 'd') keys.d = true;
  if (k === ' ') keys.space = true; if (k === 'shift') keys.shift = true;

  if (!state.started) return;

  if (k === 'b') {
    if (state.shopOpen) closeShop(); else openShop();
  }

  if (state.shopOpen) {
    if (e.key === 'ArrowUp') { state.shopIndex = (state.shopIndex - 1 + SHOP_ITEMS.length) % SHOP_ITEMS.length; renderShop(); }
    if (e.key === 'ArrowDown') { state.shopIndex = (state.shopIndex + 1) % SHOP_ITEMS.length; renderShop(); }
    if (e.key === 'Enter') buyCurrent();
  }
});
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'w') keys.w = false; if (k === 'a') keys.a = false; if (k === 's') keys.s = false; if (k === 'd') keys.d = false;
  if (k === ' ') keys.space = false; if (k === 'shift') keys.shift = false;
});

let mouseDown = false;
window.addEventListener('mousedown', (e) => {
  if (!state.started || state.dead) return;
  if (e.button === 0) { attack(); tryHitAnimal(); }
  if (e.button === 2) e.preventDefault();
  mouseDown = true;
});
window.addEventListener('mouseup', () => { mouseDown = false; });
window.addEventListener('mousemove', (e) => {
  if (!state.started || state.dead) return;
  if (!mouseDown) return;
  player.yaw -= e.movementX * 0.003;
});
window.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

document.getElementById('startBtn').addEventListener('click', () => {
  state.started = true;
  ui.menu.classList.add('hidden');
  setHint('已进入第三人称防守战');
});
document.getElementById('restartBtn').addEventListener('click', () => location.reload());

const clock = new THREE.Clock();
updateHud();
(function tick() {
  const dt = Math.min(0.1, clock.getDelta());
  if (state.started && !state.dead) {
    updatePlayer(dt);
    updateVillage(dt);
    updateAnimals(dt);
    updateZombies(dt);
    updateBullets(dt);
    updateHud();
  }
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}());
