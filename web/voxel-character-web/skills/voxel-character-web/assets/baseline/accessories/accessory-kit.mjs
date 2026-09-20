import * as THREE from '../../three/build/three.module.js';

const EPS = 1e-8;
const fail = message => { throw new Error(`Accessory kit: ${message}`); };
const clone = value => JSON.parse(JSON.stringify(value));
const finite = value => typeof value === 'number' && Number.isFinite(value);
const positive = (value, label) => { if (!finite(value) || value <= 0) fail(`${label} must be positive`); return value; };
const vec = (value, label) => {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(finite)) fail(`${label} must be a finite vec3`);
  return new THREE.Vector3(...value);
};
const named = (value, label) => { if (typeof value !== 'string' || !value.trim()) fail(`${label} is required`); return value; };
const colorValue = value => {
  if (value instanceof THREE.Color) return value;
  if (!(Number.isInteger(value) && value >= 0 && value <= 0xffffff) && !(typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value))) fail('color must be a hex number or #RGB/#RRGGBB');
  return new THREE.Color(value);
};

function surfaceBuilder(color) {
  const positions = [], normals = [], colors = [], indices = [], pathT = [], c = colorValue(color);
  return {
    quad(points, ts = [0, 0, 0, 0]) {
      const first = positions.length / 3;
      const a = new THREE.Vector3(...points[0]), b = new THREE.Vector3(...points[1]), d = new THREE.Vector3(...points[3]);
      const n = b.sub(a).cross(d.sub(a)).normalize();
      if (n.lengthSq() < EPS) fail('degenerate surface');
      for (let i = 0; i < 4; i++) { positions.push(...points[i]); normals.push(...n); colors.push(c.r, c.g, c.b); pathT.push(ts[i]); }
      indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
    },
    finish() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      g.setAttribute('pathT', new THREE.Float32BufferAttribute(pathT, 1));
      g.setIndex(indices); g.computeBoundingBox(); g.computeBoundingSphere();
      return g;
    },
  };
}

function dimensions(g) {
  const center = vec(g.center ?? [0, 0, 0], 'geometry.center');
  const size = vec(g.size, 'geometry.size');
  size.toArray().forEach((n, i) => positive(n, `geometry.size[${i}]`));
  return { center, size };
}

/** A solid rectangular plate; coordinates and thickness are model-local. */
export function createPlate(g, color = 0xffffff) {
  const { center, size } = dimensions(g), c = colorValue(color);
  const geometry = new THREE.BoxGeometry(...size.toArray()).translate(...center.toArray());
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: geometry.attributes.position.count }, () => c.toArray()).flat(), 3));
  geometry.setAttribute('pathT', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count), 1));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

/** Rectangular frame with a real through-hole along Z, including its inner walls. */
export function createFrame(g, color = 0xffffff) {
  const { center: c, size: s } = dimensions(g);
  if (!Array.isArray(g.opening) || g.opening.length !== 2) fail('frame.opening requires width and height');
  const [w, h] = g.opening.map((n, i) => positive(n, `frame.opening[${i}]`));
  if (w >= s.x || h >= s.y) fail('frame opening must be smaller than its outer dimensions');
  const out = [[-s.x / 2, -s.y / 2], [s.x / 2, -s.y / 2], [s.x / 2, s.y / 2], [-s.x / 2, s.y / 2]];
  const inside = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
  const p = (ring, i, z) => [c.x + ring[i][0], c.y + ring[i][1], c.z + z];
  const b = surfaceBuilder(color), z = s.z / 2;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    b.quad([p(out, i, z), p(out, j, z), p(inside, j, z), p(inside, i, z)]);
    b.quad([p(out, j, -z), p(out, i, -z), p(inside, i, -z), p(inside, j, -z)]);
    b.quad([p(out, i, -z), p(out, j, -z), p(out, j, z), p(out, i, z)]);
    b.quad([p(inside, j, -z), p(inside, i, -z), p(inside, i, z), p(inside, j, z)]);
  }
  return b.finish();
}

/** Open +Z box, with finite wall thickness, inner surfaces and an open front rim. */
export function createShell(g, color = 0xffffff) {
  const { center: c, size: s } = dimensions(g), wall = positive(g.wall, 'shell.wall');
  if (g.openSide !== undefined && g.openSide !== '+Z') fail('shell currently supports openSide +Z only');
  if (wall * 2 >= Math.min(s.x, s.y) || wall >= s.z) fail('shell wall leaves no interior');
  const b = surfaceBuilder(color), x = s.x / 2, y = s.y / 2, z = s.z / 2;
  const outer = [[-x, -y], [x, -y], [x, y], [-x, y]], inner = [[-x + wall, -y + wall], [x - wall, -y + wall], [x - wall, y - wall], [-x + wall, y - wall]];
  const p = (ring, i, depth) => [c.x + ring[i][0], c.y + ring[i][1], c.z + depth];
  b.quad([3, 2, 1, 0].map(i => p(outer, i, -z)));
  b.quad([0, 1, 2, 3].map(i => p(inner, i, -z + wall)));
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    b.quad([p(outer, i, -z), p(outer, j, -z), p(outer, j, z), p(outer, i, z)]);
    b.quad([p(inner, j, -z + wall), p(inner, i, -z + wall), p(inner, i, z), p(inner, j, z)]);
    b.quad([p(outer, i, z), p(outer, j, z), p(inner, j, z), p(inner, i, z)]);
  }
  return b.finish();
}

function samplePath(g) {
  if (!Array.isArray(g.points) || g.points.length < 2) fail('path requires at least two points');
  const raw = g.points.map((p, i) => vec(p, `points[${i}]`));
  if (g.step !== undefined) positive(g.step, 'path.step');
  if (g.subdivisions !== undefined && (!Number.isInteger(g.subdivisions) || g.subdivisions < 1 || g.subdivisions > 1024)) fail('subdivisions must be an integer from 1 to 1024');
  if (g.step !== undefined && g.subdivisions !== undefined) fail('choose step or subdivisions');
  const points = [raw[0]], distance = [0];
  for (let i = 1; i < raw.length; i++) {
    const length = raw[i].distanceTo(raw[i - 1]);
    if (length < EPS) fail('path has duplicate consecutive points');
    const count = g.step !== undefined ? Math.ceil(length / g.step) : (g.subdivisions ?? 1);
    if (points.length + count > 8192) fail('path exceeds 8192 rings; increase step');
    for (let k = 1; k <= count; k++) {
      points.push(raw[i - 1].clone().lerp(raw[i], k / count));
      distance.push(distance.at(-1) + length / count);
    }
  }
  return { points, ts: distance.map(d => d / distance.at(-1)) };
}

function sweep(g, width, thickness, color) {
  positive(width, 'path.width'); positive(thickness, 'path.thickness');
  const { points, ts } = samplePath(g), b = surfaceBuilder(color), rings = [];
  if (g.widthAxis !== undefined && g.normal !== undefined) fail('choose path.widthAxis or path.normal');
  const preferredWidth = g.widthAxis === undefined ? null : vec(g.widthAxis, 'path.widthAxis').normalize();
  if (preferredWidth && preferredWidth.lengthSq() < EPS) fail('path.widthAxis cannot be zero');
  const closed = points[0].distanceTo(points.at(-1)) < EPS;
  let previousNormal = g.normal === undefined ? new THREE.Vector3(0, 0, 1) : vec(g.normal, 'path.normal');
  if (previousNormal.lengthSq() < EPS) fail('path.normal cannot be zero');
  previousNormal.normalize();
  for (let i = 0; i < points.length; i++) {
    let tangent;
    if (closed && (i === 0 || i === points.length - 1)) {
      tangent = points[0].clone().sub(points.at(-2)).normalize().add(points[1].clone().sub(points[0]).normalize());
      if (tangent.lengthSq() < EPS) fail('closed path reverses at its seam'); tangent.normalize();
    }
    else if (i === 0) tangent = points[1].clone().sub(points[0]).normalize();
    else if (i === points.length - 1) tangent = points[i].clone().sub(points[i - 1]).normalize();
    else {
      const incoming = points[i].clone().sub(points[i - 1]).normalize(), outgoing = points[i + 1].clone().sub(points[i]).normalize();
      if (incoming.dot(outgoing) < -.95) fail('path makes a near reversal; split it into separate parts');
      tangent = incoming.add(outgoing).normalize();
    }
    let normal = previousNormal.clone().addScaledVector(tangent, -previousNormal.dot(tangent));
    if (normal.lengthSq() < EPS) {
      const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)].sort((a, c) => Math.abs(a.dot(tangent)) - Math.abs(c.dot(tangent)));
      normal = axes[0].addScaledVector(tangent, -axes[0].dot(tangent));
    }
    normal.normalize();
    const u = preferredWidth ? preferredWidth.clone().addScaledVector(tangent, -preferredWidth.dot(tangent)) : normal.clone().cross(tangent);
    if (u.lengthSq() < EPS) fail('widthAxis cannot be parallel to the path tangent');
    u.normalize();
    const v = tangent.clone().cross(u).normalize();
    previousNormal = v;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, c]) => points[i].clone().addScaledVector(u, a * width / 2).addScaledVector(v, c * thickness / 2).toArray());
    rings.push({ t: ts[i], center: points[i].toArray(), tangent: tangent.toArray(), widthAxis: u.toArray(), normal: v.toArray(), corners });
  }
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < 4; j++) {
    const k = (j + 1) % 4;
    b.quad([rings[i].corners[j], rings[i].corners[k], rings[i + 1].corners[k], rings[i + 1].corners[j]], [ts[i], ts[i], ts[i + 1], ts[i + 1]]);
  }
  if (!closed) {
    b.quad([3, 2, 1, 0].map(i => rings[0].corners[i]), [0, 0, 0, 0]);
    b.quad(rings.at(-1).corners, [1, 1, 1, 1]);
  }
  const geometry = b.finish(); geometry.userData.pathRings = rings;
  return geometry;
}

export const createStrap = (g, color = 0xffffff) => sweep(g, g.width, g.thickness, color);
export const createCord = (g, color = 0xffffff) => sweep(g, g.width, g.width, color);

function validateBinding(binding, shapeMode) {
  if (!binding || (binding.bone !== undefined) === (binding.stations !== undefined)) fail('binding needs exactly one of bone or stations');
  if (binding.bone !== undefined) { named(binding.bone, 'binding.bone'); return; }
  if (!Array.isArray(binding.stations) || binding.stations.length < 2) fail('binding.stations needs at least two stations');
  let previous = -1;
  for (const station of binding.stations) {
    if (!finite(station.t) || station.t < 0 || station.t > 1 || station.t <= previous) fail('station t values must strictly increase in [0,1]');
    named(station.bone, 'station.bone'); previous = station.t;
  }
  if (binding.stations[0].t !== 0 || binding.stations.at(-1).t !== 1) fail('stations must span t=0 to t=1');
  if (shapeMode === 'rigid' && new Set(binding.stations.map(s => s.bone)).size > 1) fail('rigid parts cannot bind to varying station bones');
}

/** Linear weights along normalized arc length; at most two distinct influences. */
export function accessoryWeights(binding, t, idFn) {
  validateBinding(binding);
  if (!finite(t)) fail('pathT must be finite');
  const resolve = name => {
    const index = idFn(name);
    if (!Number.isInteger(index) || index < 0) fail(`missing bone ${name}`);
    return index;
  };
  if (binding.bone) return [[resolve(binding.bone), 1]];
  const stations = binding.stations, clamped = Math.max(0, Math.min(1, t));
  const i = Math.max(0, stations.findIndex(s => s.t >= clamped) - 1), a = stations[i], c = stations[i + 1];
  const blend = Math.max(0, Math.min(1, (clamped - a.t) / (c.t - a.t)));
  const left = resolve(a.bone), right = resolve(c.bone);
  if (left === right) return [[left, 1]];
  return [[left, 1 - blend], [right, blend]].filter(([, w]) => w > EPS);
}

const constructors = { plate: createPlate, frame: createFrame, strap: createStrap, cord: createCord, shell: createShell };

/** Validate before adding anything; no-op for an empty part list preserves the base model. */
export function applyAccessories(root, spec) {
  if (spec === undefined || spec === null) return [];
  if (!spec || spec.version !== 1) fail('spec.version must be 1');
  if (!Array.isArray(spec.parts)) fail('spec.parts must be an array');
  if (spec.parts.length && root.userData.accessoryRig) fail('applyAccessories must be called once with the complete spec');
  const palette = spec.palette ?? {}, anchors = spec.anchors ?? {}, bones = spec.bones ?? [], dynamics = spec.dynamics ?? [];
  if (!anchors || typeof anchors !== 'object' || Array.isArray(anchors)) fail('anchors must be an object keyed by unique ID');
  if (!Array.isArray(bones) || !Array.isArray(dynamics)) fail('bones and dynamics must be arrays');
  const ids = new Set(), boneNames = new Set();
  for (const bone of bones) {
    named(bone.name, 'bone.name'); named(bone.parent, 'bone.parent'); vec(bone.position, 'bone.position');
    if (bone.name === bone.parent || boneNames.has(bone.name)) fail(`duplicate or self-parent bone ${bone.name}`);
    boneNames.add(bone.name);
  }
  const cycle = name => {
    const seen = new Set(); let current = bones.find(b => b.name === name);
    while (current) { if (seen.has(current.name)) fail(`bone cycle at ${current.name}`); seen.add(current.name); current = bones.find(b => b.name === current.parent); }
  };
  bones.forEach(b => cycle(b.name));
  const dynamicNames = new Set();
  for (const d of dynamics) {
    named(d.bone, 'dynamics.bone');
    if (!boneNames.has(d.bone)) fail(`dynamic bone must be declared in accessory bones: ${d.bone}`);
    if (dynamicNames.has(d.bone)) fail(`duplicate dynamic bone ${d.bone}`); dynamicNames.add(d.bone);
    if (vec(d.axis, 'dynamics.axis').lengthSq() < EPS) fail('dynamics.axis cannot be zero');
    positive(d.stiffness, 'dynamics.stiffness'); positive(d.damping, 'dynamics.damping'); positive(d.maxAngle, 'dynamics.maxAngle');
    if (d.maxAngle > Math.PI / 2) fail('dynamics.maxAngle must be <= pi/2 radians');
  }
  for (const [id, anchor] of Object.entries(anchors)) {
    named(id, 'anchor ID'); vec(anchor.position, `anchor ${id}.position`); named(anchor.bone, `anchor ${id}.bone`); named(anchor.owner, `anchor ${id}.owner`);
    if (!['observed', 'inferred'].includes(anchor.evidence)) fail(`anchor ${id}.evidence must be observed or inferred`);
  }
  const meshes = [], material = root.children.find(child => child.isMesh)?.material;
  if (spec.parts.length && (!material || Array.isArray(material))) fail('root needs a shared single mesh material');
  try {
    for (const part of spec.parts) {
      named(part.id, 'part.id');
      if (ids.has(part.id) || root.getObjectByName(`Acc_${part.id}`)) fail(`duplicate part ${part.id}`); ids.add(part.id);
      if (!Object.hasOwn(constructors, part.kind)) fail(`unknown kind ${part.kind}`);
      if (!['rigid', 'deformable'].includes(part.shapeMode)) fail(`${part.id} needs shapeMode rigid or deformable`);
      if (!['follow', 'secondary'].includes(part.motionMode)) fail(`${part.id} needs motionMode follow or secondary`);
      if (part.shapeMode === 'deformable' && !['strap', 'cord'].includes(part.kind)) fail(`${part.id}: deformable geometry currently requires strap or cord`);
      if (!['observed', 'inferred'].includes(part.evidence)) fail(`${part.id}.evidence must be observed or inferred`);
      validateBinding(part.binding, part.shapeMode);
      if (part.binding.stations && !['strap', 'cord'].includes(part.kind)) fail(`${part.id}: stations require path geometry`);
      if (!Object.hasOwn(palette, part.color)) fail(`missing semantic palette color ${part.color}`);
      const attachments = part.attachments ?? [];
      if (!Array.isArray(attachments)) fail(`${part.id}.attachments must be an array`);
      for (const connection of attachments) {
        const anchor = anchors[connection.anchor]; if (!anchor) fail(`${part.id}: missing anchor ${connection.anchor}`);
        const at = vec(connection.at, `${part.id}.attachment.at`), tolerance = connection.tolerance ?? .02;
        if (!finite(tolerance) || tolerance < 0) fail('attachment tolerance must be nonnegative');
        if (at.distanceTo(vec(anchor.position, 'anchor.position')) > tolerance + EPS) fail(`${part.id}: attachment ${connection.anchor} exceeds declared tolerance`);
      }
      const geometry = constructors[part.kind](part.geometry ?? {}, palette[part.color]);
      const mesh = new THREE.Mesh(geometry, material); mesh.name = `Acc_${part.id}`;
      mesh.userData.accessory = clone(part); mesh.userData.accessory.attachments = clone(attachments); mesh.userData.accessory.anchors = Object.fromEntries(attachments.map(a => [a.anchor, clone(anchors[a.anchor])]));
      meshes.push(mesh);
    }
    for (const [id, anchor] of Object.entries(anchors)) if (!root.getObjectByName(anchor.owner) && !ids.has(anchor.owner) && !meshes.some(m => m.name === anchor.owner)) fail(`anchor ${id} owner does not exist: ${anchor.owner}`);
    const isSecondary = name => {
      const seen = new Set(); let current = name;
      while (current && !seen.has(current)) { if (dynamicNames.has(current)) return true; seen.add(current); current = bones.find(b => b.name === current)?.parent; }
      return false;
    };
    for (const part of spec.parts) {
      const bound = part.binding.bone ? [part.binding.bone] : part.binding.stations.map(s => s.bone);
      if (part.motionMode === 'secondary' && !bound.some(isSecondary)) fail(`${part.id}: secondary motion needs a dynamic bone in its binding ancestry`);
    }
  } catch (error) { meshes.forEach(mesh => mesh.geometry.dispose()); throw error; }
  if (!meshes.length) return [];
  root.add(...meshes);
  root.userData.accessoryRig = { version: 1, bones: clone(bones), dynamics: clone(dynamics) };
  root.userData.accessories = { version: 1, parts: meshes.length, anchors: clone(anchors), triangleCount: meshes.reduce((n, m) => n + m.geometry.index.count / 3, 0) };
  let triangleCount = 0;
  root.traverse(node => { if (node.isMesh) triangleCount += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3; });
  root.userData.triangles = triangleCount;
  return meshes;
}

/** The callback has signature bone(name, parentIndex, modelLocalPosition). */
export function addAccessoryBones(rigSpec, boneFn, bones) {
  const pending = [...(rigSpec?.bones ?? [])], known = new Map(bones.map((b, i) => [b.name, i]));
  for (const b of pending) if (known.has(b.name)) fail(`accessory bone collides with existing bone ${b.name}`);
  const seen = new Set();
  for (const b of pending) { if (seen.has(b.name)) fail(`duplicate accessory bone ${b.name}`); seen.add(b.name); }
  const plan = [], simulated = new Map(known);
  while (pending.length) {
    const i = pending.findIndex(b => simulated.has(b.parent));
    if (i < 0) fail(`unresolved accessory bone parents or cycle: ${pending.map(b => `${b.name}->${b.parent}`).join(', ')}`);
    const [b] = pending.splice(i, 1); vec(b.position, `bone ${b.name}.position`); plan.push(b); simulated.set(b.name, simulated.size);
  }
  for (const b of plan) {
    const index = boneFn(b.name, known.get(b.parent), [...b.position]);
    if (!Number.isInteger(index) || index < 0) fail(`bone callback must return index for ${b.name}`);
    known.set(b.name, index);
  }
  return plan.map(b => known.get(b.name));
}
