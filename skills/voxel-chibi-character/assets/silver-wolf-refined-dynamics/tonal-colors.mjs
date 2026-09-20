import * as THREE from 'three';

// Local color study. Each existing face keeps its topology and constant color.
// Independent semantic keys prevent clothing changes from reaching hair or eyes.
export const tonalPalette = {
  bodicePanel: '#2b3039',
  coatPanel: '#3a4049',
  coatSide: '#282d35',
  sleeveTop: '#30363f',
  sleevePanel: '#2b3039',
  sleeveCuff: '#353b44',
  shoeTop: '#343a43',
  shoeToe: '#2b3039',
  pouchFlap: '#4a5b6b',
  pouchRim: '#425362',
  pouchRecess: '#2e3b49',
};
const originalCoat = new THREE.Color('#20242b');
const originalCoatLight = new THREE.Color('#30353c');
const matches = (a, b) => a.distanceToSquared(b) < 1e-12;

export function applyTonalColors(root) {
  const targets = /^(Bodice|Coat_[LR]|Sleeve_[LR]|Shoe_[LR]|Acc_pouch|Acc_pouch_flap)$/;
  const changes = [];
  for (const mesh of root.children) {
    if (!targets.test(mesh.name)) continue;
    const g = mesh.geometry, p = g.attributes.position, colors = g.attributes.color;
    const indices = g.index.array, occupied = new Set();
    const counts = {};
    if (indices.length % 6) throw new Error(`${mesh.name}: expected paired face triangles`);
    for (let offset = 0; offset < indices.length; offset += 6) {
      const ids = [...new Set(indices.slice(offset, offset + 6))];
      // The authored faces use separate vertices at hard boundaries. Refuse to
      // introduce color interpolation if a future source shares those vertices.
      for (const id of ids) {
        if (occupied.has(id)) throw new Error(`${mesh.name}: shared face vertex`);
        occupied.add(id);
      }
      const points = ids.map(id => new THREE.Vector3().fromBufferAttribute(p, id));
      const center = points.reduce((a, b) => a.add(b), new THREE.Vector3()).divideScalar(points.length);
      const a = new THREE.Vector3().fromBufferAttribute(p, indices[offset]);
      const b = new THREE.Vector3().fromBufferAttribute(p, indices[offset + 1]);
      const c = new THREE.Vector3().fromBufferAttribute(p, indices[offset + 2]);
      const normal = b.sub(a).cross(c.sub(a)).normalize();
      const old = new THREE.Vector3().fromBufferAttribute(colors, ids[0]);
      for (const id of ids) if (!matches(old, new THREE.Vector3().fromBufferAttribute(colors, id))) {
        throw new Error(`${mesh.name}: source face is not a flat color`);
      }
      const coat = matches(old, new THREE.Vector3(originalCoat.r, originalCoat.g, originalCoat.b));
      const coatLight = matches(old, new THREE.Vector3(originalCoatLight.r, originalCoatLight.g, originalCoatLight.b));
      let key;
      if (mesh.name === 'Bodice' && coat && normal.z > .9 && center.y > 1.61 && center.x > .04) {
        key = 'bodicePanel';
      } else if (mesh.name.startsWith('Coat_')) {
        // Existing stepped front faces form one broad panel, without thin stripes.
        if (coatLight && normal.z > .9 && center.z > .3 && center.y > 1.02 && center.y < 1.53) key = 'coatPanel';
        else if (coatLight && Math.abs(normal.x) > .9 && center.y > .935) key = 'coatSide';
      } else if (mesh.name.startsWith('Sleeve_') && coat) {
        const x = Math.abs(center.x);
        if (normal.y > .9 && center.y > 2.14) key = 'sleeveTop';
        if (normal.z > .9 && center.z > .17 && x > .44) key = x > 1.01 ? 'sleeveCuff' : 'sleevePanel';
      } else if (mesh.name.startsWith('Shoe_')) {
        if (normal.y > .9) key = 'shoeTop';
        else if (normal.z > .9) key = 'shoeToe';
      } else if (mesh.name === 'Acc_pouch_flap' && normal.z > .9) {
        key = 'pouchFlap';
      } else if (mesh.name === 'Acc_pouch' && normal.z > .9) {
        key = center.z > .27 ? 'pouchRim' : 'pouchRecess';
      }
      if (!key) continue;
      const rgb = new THREE.Color(tonalPalette[key]);
      for (const id of ids) colors.setXYZ(id, rgb.r, rgb.g, rgb.b);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    if (Object.keys(counts).length) {
      colors.needsUpdate = true;
      changes.push({ mesh: mesh.name, faces: counts });
    }
  }
  return { version: 'technical-kit-tonal-v1', palette: tonalPalette, changes };
}
