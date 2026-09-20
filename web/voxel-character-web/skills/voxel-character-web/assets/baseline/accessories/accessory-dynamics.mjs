import * as THREE from '../../three/build/three.module.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const sanitized = name => name.replace(/\s/g, '_').replace(/[\[\]\.:/]/g, '');
const resolve = (rig, name) => rig.getObjectByName(name) ?? rig.getObjectByName(sanitized(name));

/** Optional bounded angular springs; no mesh collision or two-end constraint solver. */
export class AccessoryDynamics {
  constructor(rig) {
    this.rig = rig;
    this.root = null;
    rig.traverse(node => { if (!this.root && node.userData?.accessoryRig) this.root = node; });
    this.step = 1 / 120; this.accumulator = 0; this._enabled = true;
    this.metrics = { steps: 0, resets: 0, maxAngle: 0, finite: true, scope: 'Bounded single-axis angular springs; no mesh collision or endpoint constraints' };
    this.states = (this.root?.userData.accessoryRig.dynamics ?? []).map(definition => {
      const bone = resolve(rig, definition.bone);
      if (!bone?.isBone) throw new Error(`Accessory dynamics: bone not found: ${definition.bone}`);
      if (!bone.parent) throw new Error(`Accessory dynamics: bone has no parent: ${definition.bone}`);
      const axis = new THREE.Vector3(...definition.axis).normalize();
      if (axis.lengthSq() < 1e-8 || ![definition.stiffness, definition.damping, definition.maxAngle].every(n => Number.isFinite(n) && n > 0)) throw new Error(`Accessory dynamics: invalid spring ${definition.bone}`);
      return { ...definition, bone, axis, rest: bone.quaternion.clone(), angle: 0, velocity: 0, pivotPosition: new THREE.Vector3(), parentQuaternion: new THREE.Quaternion(), linearVelocity: new THREE.Vector3(), angularVelocity: 0, force: 0 };
    });
    this.lastPosition = new THREE.Vector3();
    this.reset();
  }

  get enabled() { return this._enabled; }
  set enabled(value) {
    const enabled = Boolean(value);
    if (enabled !== this._enabled) { this._enabled = enabled; this.reset(); }
  }

  reset() {
    this.accumulator = 0;
    for (const state of this.states) { state.angle = 0; state.velocity = 0; state.force = 0; state.angularVelocity = 0; state.linearVelocity.set(0, 0, 0); state.bone.quaternion.copy(state.rest); }
    this.rig.updateMatrixWorld(true);
    for (const state of this.states) {
      state.bone.getWorldPosition(state.pivotPosition);
      state.bone.parent.getWorldQuaternion(state.parentQuaternion);
    }
    this.rig.getWorldPosition(this.lastPosition);
    this.metrics.resets++;
  }

  kick(amount = 1) {
    if (!Number.isFinite(amount)) throw new Error('Accessory dynamics: kick must be finite');
    if (!this.enabled) return;
    for (const state of this.states) state.velocity = clamp(state.velocity + amount, -8, 8);
  }

  update(dt) {
    if (!Number.isFinite(dt) || dt < 0) throw new Error('Accessory dynamics: dt must be finite and nonnegative');
    if (!this.enabled || dt === 0 || !this.states.length) return;
    if (dt > .2) { this.reset(); return; }
    this.rig.updateMatrixWorld(true);
    const position = this.rig.getWorldPosition(new THREE.Vector3());
    if (position.distanceTo(this.lastPosition) > 1) { this.reset(); return; }
    this.lastPosition.copy(position);
    for (const state of this.states) {
      // Rotation moves an off-center attachment even when its parent's origin is fixed.
      // Sample that actual pivot; the spring's own rotation does not move its origin.
      const p = state.bone.getWorldPosition(new THREE.Vector3()), q = state.bone.parent.getWorldQuaternion(new THREE.Quaternion());
      if (p.distanceTo(state.pivotPosition) > 1 || q.angleTo(state.parentQuaternion) > Math.PI / 2) { this.reset(); return; }
      const velocity = p.clone().sub(state.pivotPosition).divideScalar(dt);
      const acceleration = velocity.clone().sub(state.linearVelocity).divideScalar(dt).applyQuaternion(q.clone().invert());
      const delta = state.parentQuaternion.clone().invert().multiply(q);
      if (delta.w < 0) delta.set(-delta.x, -delta.y, -delta.z, -delta.w);
      const halfSine = Math.hypot(delta.x, delta.y, delta.z);
      const rotation = halfSine > 1e-8 ? new THREE.Vector3(delta.x, delta.y, delta.z).multiplyScalar(2 * Math.atan2(halfSine, delta.w) / halfSine) : new THREE.Vector3();
      const angularVelocity = rotation.dot(state.axis) / dt;
      const angularAcceleration = (angularVelocity - state.angularVelocity) / dt;
      const torque = new THREE.Vector3(0, -1, 0).cross(acceleration).dot(state.axis);
      state.force = clamp(-.06 * angularAcceleration - .05 * torque, -20, 20);
      state.pivotPosition.copy(p); state.parentQuaternion.copy(q); state.linearVelocity.copy(velocity); state.angularVelocity = angularVelocity;
    }
    this.accumulator += dt;
    while (this.accumulator + 1e-10 >= this.step) {
      this.accumulator -= this.step;
      for (const state of this.states) {
        // Semi-implicit spring integration at a fixed 120 Hz.
        state.velocity += (-state.stiffness * state.angle - state.damping * state.velocity + state.force) * this.step;
        state.angle += state.velocity * this.step;
        if (Math.abs(state.angle) > state.maxAngle) { state.angle = clamp(state.angle, -state.maxAngle, state.maxAngle); state.velocity = 0; }
        this.metrics.maxAngle = Math.max(this.metrics.maxAngle, Math.abs(state.angle));
        this.metrics.finite &&= Number.isFinite(state.angle) && Number.isFinite(state.velocity);
      }
      this.metrics.steps++;
    }
    for (const state of this.states) state.bone.quaternion.copy(state.rest).multiply(new THREE.Quaternion().setFromAxisAngle(state.axis, state.angle));
    this.rig.updateMatrixWorld(true);
  }
}
