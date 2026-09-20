import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../three/build/three.module.js';
import { applyAccessories, createPlate, createFrame, createStrap, createCord, createShell, accessoryWeights, addAccessoryBones } from './accessory-kit.mjs';
import { AccessoryDynamics } from './accessory-dynamics.mjs';

const v = a => new THREE.Vector3(...a);
const near = (a, b, epsilon = 1e-6) => assert.ok(Math.abs(a - b) < epsilon, `${a} differs from ${b}`);
const base = () => { const root = new THREE.Group(); const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ vertexColors: true })); mesh.name = 'Torso'; root.add(mesh); return root; };
const part = (patch = {}) => ({ id: 'card', kind: 'plate', geometry: { center: [0, 0, 0], size: [.2, .3, .02] }, color: 'card', shapeMode: 'rigid', motionMode: 'follow', binding: { bone: 'chest' }, evidence: 'observed', ...patch });
const spec = (patch = {}) => ({ version: 1, palette: { card: '#faf0d0' }, anchors: {}, bones: [], dynamics: [], parts: [part()], ...patch });

function assertClosedGeometry(geometry) {
  for (const attribute of Object.values(geometry.attributes)) assert.ok([...attribute.array].every(Number.isFinite));
  const p = geometry.attributes.position, idx = geometry.index.array, edges = new Map();
  const key = i => [p.getX(i), p.getY(i), p.getZ(i)].map(n => Math.round(n * 1e6)).join(',');
  const point = i => new THREE.Vector3().fromBufferAttribute(p, i);
  for (let i = 0; i < idx.length; i += 3) {
    const [a, b, c] = [...idx.slice(i, i + 3)];
    assert.ok(point(b).sub(point(a)).cross(point(c).sub(point(a))).length() > 1e-10, 'triangle has area');
    for (const [left, right] of [[a, b], [b, c], [c, a]]) { const edge = [key(left), key(right)].sort().join('|'); edges.set(edge, (edges.get(edge) ?? 0) + 1); }
  }
  for (const count of edges.values()) assert.equal(count, 2, 'closed surface edge occurs twice');
}

test('all five constructors have finite, nondegenerate, closed solid-wall geometry', () => {
  for (const geometry of [
    createPlate({ center: [2, 3, 4], size: [1, 2, .2] }),
    createFrame({ center: [0, 0, 0], size: [2, 3, .2], opening: [1, 2] }),
    createShell({ center: [0, 0, 0], size: [2, 3, 1], wall: .1 }),
    createStrap({ points: [[0, 0, 0], [0, -1, 0], [.2, -2, .1]], width: .1, thickness: .02, subdivisions: 3 }),
    createCord({ points: [[0, 0, 0], [0, -1, 0]], width: .04, step: .2 }),
  ]) assertClosedGeometry(geometry);
});

test('frame hole passes a ray; frame border blocks it, shell front is open', () => {
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const frame = new THREE.Mesh(createFrame({ size: [2, 2, .2], opening: [1, 1] }), material);
  const ray = new THREE.Raycaster(v([0, 0, 2]), v([0, 0, -1]));
  assert.equal(ray.intersectObject(frame).length, 0);
  ray.ray.origin.x = .75;
  assert.ok(ray.intersectObject(frame).length > 0);
  const shell = new THREE.Mesh(createShell({ size: [2, 2, 1], wall: .1 }), material);
  ray.ray.origin.x = 0;
  near(ray.intersectObject(shell)[0].point.z, -.4);
});

test('path endpoint rings lie on their requested planes and preserve width', () => {
  const points = [[1, 2, 3], [1, 1, 3.1], [1.2, 0, 3.1]];
  const geometry = createStrap({ points, width: .1, thickness: .02, step: .12 });
  const rings = geometry.userData.pathRings;
  assert.deepEqual(rings[0].center, points[0]); assert.deepEqual(rings.at(-1).center, points.at(-1));
  for (const ring of [rings[0], rings.at(-1)]) {
    near(v(ring.corners[1]).distanceTo(v(ring.corners[0])), .1);
    near(v(ring.corners[2]).distanceTo(v(ring.corners[1])), .02);
    for (const corner of ring.corners) near(v(corner).sub(v(ring.center)).dot(v(ring.tangent)), 0);
  }
  near(Math.min(...geometry.attributes.pathT.array), 0); near(Math.max(...geometry.attributes.pathT.array), 1);
  for (let i = 1; i < rings.length; i++) assert.ok(rings[i].t > rings[i - 1].t);
});

test('closed belt preserves Y width around XZ corners and closes its seam', () => {
  const geometry = createStrap({ points: [[-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], [-1, 0, -1]], width: .2, thickness: .05, widthAxis: [0, 1, 0], step: .4 });
  const rings = geometry.userData.pathRings;
  for (const ring of rings) assert.deepEqual(ring.widthAxis, [0, 1, 0]);
  assert.deepEqual(rings.at(-1).corners, rings[0].corners);
  assertClosedGeometry(geometry);
});

test('weights interpolate by path t, combine repeated bones, and normalize', () => {
  const binding = { stations: [{ t: 0, bone: 'chest' }, { t: .4, bone: 'chest' }, { t: 1, bone: 'hips' }] }, id = n => ({ chest: 4, hips: 2 })[n];
  assert.deepEqual(accessoryWeights(binding, .2, id), [[4, 1]]);
  const halfway = accessoryWeights(binding, .7, id); near(halfway[0][1], .5); near(halfway[1][1], .5);
  for (let i = -10; i <= 110; i++) {
    const weights = accessoryWeights(binding, i / 100, id);
    near(weights.reduce((sum, [, w]) => sum + w, 0), 1); assert.ok(weights.every(([, w]) => w > 0));
  }
  assert.deepEqual(accessoryWeights({ bone: 'hips' }, 0, id), [[2, 1]]);
  assert.throws(() => accessoryWeights({ bone: 'missing' }, 0, id), /missing bone/);
});

test('application reuses material, preserves metadata, and empty spec changes nothing', () => {
  const root = base(), before = JSON.stringify(root.toJSON());
  assert.deepEqual(applyAccessories(root), []); assert.equal(JSON.stringify(root.toJSON()), before);
  assert.deepEqual(applyAccessories(root, spec({ parts: [] })), []); assert.equal(JSON.stringify(root.toJSON()), before);
  const [card] = applyAccessories(root, spec());
  assert.equal(card.material, root.children[0].material); assert.equal(card.parent, root); assert.equal(card.name, 'Acc_card');
  assert.deepEqual(card.position.toArray(), [0, 0, 0]); assert.equal(card.userData.accessory.binding.bone, 'chest');
  assert.equal(root.userData.accessories.parts, 1);
  assert.equal(root.userData.triangles, 24);
});

test('invalid specs reject atomically before altering root', () => {
  const invalid = [
    spec({ parts: [part({ kind: 'guess' })] }),
    spec({ parts: [part({ color: 'missing' })] }),
    spec({ parts: [part(), part()] }),
    spec({ parts: [part({ geometry: { size: [1, 0, 1] } })] }),
    spec({ parts: [part({ binding: { bone: 'chest', stations: [] } })] }),
    spec({ parts: [part({ kind: 'strap', geometry: { points: [[0, 0, 0], [0, 1, 0]], width: .1, thickness: .1 }, binding: { stations: [{ t: 0, bone: 'chest' }, { t: 1, bone: 'hips' }] } })] }),
    spec({ parts: [part({ attachments: [{ anchor: 'missing', at: [0, 0, 0] }] })] }),
    spec({ bones: [{ name: 'a', parent: 'b', position: [0, 0, 0] }, { name: 'b', parent: 'a', position: [0, 0, 0] }] }),
    spec({ parts: [part({ motionMode: 'secondary' })] }),
    spec({ anchors: { seam: { position: [0, 0, 0], owner: 'missing', bone: 'chest', evidence: 'observed' } } }),
    spec({ anchors: { seam: { position: [1, 0, 0], owner: 'Torso', bone: 'chest', evidence: 'observed' } }, parts: [part({ attachments: [{ anchor: 'seam', at: [0, 0, 0] }] })] }),
  ];
  for (const input of invalid) { const root = base(), before = JSON.stringify(root.toJSON()); assert.throws(() => applyAccessories(root, input), /Accessory kit/); assert.equal(JSON.stringify(root.toJSON()), before); }
  assert.throws(() => createFrame({ size: [1, 1, 1], opening: [2, 2] }), /opening/);
  assert.throws(() => createShell({ size: [1, 1, 1], wall: .6 }), /interior/);
  assert.throws(() => createCord({ points: [[0, 0, 0], [0, 0, 0]], width: .1 }), /duplicate/);
  assert.throws(() => createStrap({ points: [[0, 0, 0], [0, 1, 0]], width: .1, thickness: .1, widthAxis: [0, 1, 0] }), /parallel/);
});

test('dependency-order bone addition validates missing parents before mutation', () => {
  const bones = [{ name: 'chest' }], callback = (name, parent, position) => bones.push({ name, parent, position }) - 1;
  addAccessoryBones({ bones: [{ name: 'tip', parent: 'root', position: [0, 0, 0] }, { name: 'root', parent: 'chest', position: [0, 1, 0] }] }, callback, bones);
  assert.deepEqual(bones.map(b => b.name), ['chest', 'root', 'tip']); assert.equal(bones[2].parent, 1);
  assert.throws(() => addAccessoryBones({ bones: [{ name: 'bad', parent: 'missing', position: [0, 0, 0] }] }, callback, bones), /unresolved/); assert.equal(bones.length, 3);
});

function dynamicRig() {
  const rig = new THREE.Group(), chest = new THREE.Bone(), hanger = new THREE.Bone(); chest.name = 'chest'; hanger.name = 'badgebone'; hanger.position.y = 1;
  rig.add(chest); chest.add(hanger);
  rig.userData.accessoryRig = { dynamics: [{ bone: 'badge.bone', axis: [0, 0, 1], stiffness: 70, damping: 12, maxAngle: .2 }] };
  const geometry = createPlate({ center: [0, .75, 0], size: [.2, .3, .02] });
  const skinIndex = [], skinWeight = [];
  for (let i = 0; i < geometry.attributes.position.count; i++) { skinIndex.push(1, 0, 0, 0); skinWeight.push(1, 0, 0, 0); }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4)); geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial()); rig.add(mesh); rig.updateMatrixWorld(true); mesh.bind(new THREE.Skeleton([chest, hanger]));
  return { rig, chest, hanger, mesh, physics: new AccessoryDynamics(rig) };
}

test('actual skinned rigid accessory follows its dynamic bone without changing distances', () => {
  const { mesh, physics, hanger } = dynamicRig();
  const rest = Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => mesh.getVertexPosition(i, new THREE.Vector3()));
  physics.kick(); for (let i = 0; i < 10; i++) physics.update(1 / 120); mesh.skeleton.update();
  assert.ok(hanger.quaternion.angleTo(new THREE.Quaternion()) > .01);
  const moved = rest.map((_, i) => mesh.getVertexPosition(i, new THREE.Vector3()));
  assert.ok(moved[0].distanceTo(rest[0]) > .001);
  for (let i = 1; i < rest.length; i++) near(moved[0].distanceTo(moved[i]), rest[0].distanceTo(rest[i]));
});

test('springs are frame-rate consistent, bounded, resettable and react to parent movement', () => {
  const results = [];
  for (const hz of [30, 60, 120]) {
    const { physics } = dynamicRig(); physics.kick(3);
    for (let i = 0; i < hz; i++) physics.update(1 / hz);
    results.push(physics.states[0].angle);
    assert.ok(physics.metrics.maxAngle <= .2); assert.equal(physics.metrics.finite, true);
  }
  near(results[0], results[1], 1e-10); near(results[1], results[2], 1e-10);
  const { physics, chest, rig } = dynamicRig();
  chest.position.x = .04; physics.update(1 / 60); assert.ok(Math.abs(physics.states[0].angle) > 0);
  physics.enabled = false; near(physics.states[0].angle, 0); physics.kick(); physics.update(1 / 60); near(physics.states[0].angle, 0);
  physics.enabled = true; physics.kick(); physics.update(1 / 60); assert.ok(physics.states[0].angle > 0);
  physics.update(2); near(physics.states[0].angle, 0);
  physics.kick(); physics.update(1 / 60); rig.position.x = 10; physics.update(1 / 60); near(physics.states[0].angle, 0);
  physics.kick(); for (let i = 0; i < 120 * 5; i++) physics.update(1 / 120); assert.ok(Math.abs(physics.states[0].angle) < 1e-8);
  assert.throws(() => physics.update(NaN), /finite/);
});

test('parent yaw accelerates an off-center attachment and drives its planar spring', () => {
  const { physics, chest, hanger } = dynamicRig();
  hanger.position.z = .448; physics.reset();
  for (let i = 1; i <= 240; i++) {
    chest.rotation.y = .3 * Math.sin(i / 120 * Math.PI * 2);
    physics.update(1 / 120);
  }
  assert.deepEqual(chest.position.toArray(), [0, 0, 0], 'parent origin stays fixed');
  assert.ok(physics.metrics.maxAngle > .001, 'off-center pivot acceleration creates visible Z-axis response without a kick');
  assert.ok(physics.metrics.maxAngle <= .2);
  assert.equal(physics.metrics.finite, true);
});
