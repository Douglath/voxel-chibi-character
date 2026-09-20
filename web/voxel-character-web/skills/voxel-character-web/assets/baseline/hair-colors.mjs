import * as THREE from '../three/build/three.module.js';


// Keep the v2 crown and roots joined, but restore contrast within wide locks.
// Ears, tail, face and clothing retain their own original colors.
export const hairPalette = {
  hair: '#bac3c9',
  crown: '#bec7cd',
  rear: '#adb8c1',
  rearLight: '#bec9d1',
  rearDeep: '#9cabb7',
  sideShade: '#a8b6c2',
  fringeLight: '#d0d7dc',
  fringeShade: '#a4b2bf',
};
const mapping = {
  hair: 'hair', hairShade: 'rear', backHairLight: 'rearLight',
  backHairDeep: 'rearDeep', sideHairShade: 'sideShade',
  hairSoftLight: 'fringeLight', hairSoftShade: 'fringeShade',
};

const same = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-7);

export function applyHairColors(root, palette) {
  const sourceColors = Object.fromEntries(
  ['hairLight', ...Object.keys(mapping)].map(key => [key, new THREE.Color(palette[key]).toArray()])
);
  const changes = [];
  for (const mesh of root.children) {
    if (!/^(Hair|Fringe|SideHair_[LR]|LongHair_[LR])$/.test(mesh.name)) continue;
    const g = mesh.geometry, colors = g.attributes.color, p = g.attributes.position;
    const idx = g.index.array, occupied = new Set(), counts = {};
    if (idx.length % 6) throw new Error(`${mesh.name}: expected paired face triangles`);
    for (let offset = 0; offset < idx.length; offset += 6) {
      const ids = [...new Set(idx.slice(offset, offset + 6))];
      const original = Array.from(colors.array.slice(ids[0] * 3, ids[0] * 3 + 3));
      for (const id of ids) {
        if (occupied.has(id)) throw new Error(`${mesh.name}: shared face vertex`);
        occupied.add(id);
        if (!same(original, Array.from(colors.array.slice(id * 3, id * 3 + 3)))) {
          throw new Error(`${mesh.name}: face has varying source colors`);
        }
      }
      const sourceKey = Object.keys(sourceColors).find(key => same(original, sourceColors[key]));
      if (!sourceKey) throw new Error(`${mesh.name}: unrecognized hair color`);
      let target = mapping[sourceKey];
      if (sourceKey === 'hairLight') {
        const a = new THREE.Vector3().fromBufferAttribute(p, idx[offset]);
        const b = new THREE.Vector3().fromBufferAttribute(p, idx[offset + 1]);
        const c = new THREE.Vector3().fromBufferAttribute(p, idx[offset + 2]);
        const n = b.sub(a).cross(c.sub(a)).normalize();
        // The old light cap included vertical risers, creating a white band.
        // Join each riser to the neighboring front/side/rear hair base instead.
        target = n.y > .9 ? 'crown' : n.z < -.9 ? 'rear' : 'hair';
      }
      const rgb = new THREE.Color(hairPalette[target]);
      if (same(original, rgb.toArray())) continue;
      for (const id of ids) colors.setXYZ(id, rgb.r, rgb.g, rgb.b);
      const label = `${sourceKey} -> ${target}`;
      counts[label] = (counts[label] ?? 0) + 1;
    }
    if (Object.keys(counts).length) {
      colors.needsUpdate = true;
      changes.push({mesh: mesh.name, faces: counts});
    }
  }
  return {version: 'silver-wolf-approved-hair', palette: hairPalette, changes};
}
