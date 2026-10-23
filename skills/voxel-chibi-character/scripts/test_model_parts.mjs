import assert from 'node:assert/strict';
import * as THREE from '../assets/dependencies/three/build/three.module.js';
import {snapshot,compare} from './compare_model_parts.mjs';
function fixture(){const root=new THREE.Group();for(const name of ['Hair','Coat','Coat']){const m=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());m.name=name;root.add(m);}return root;}
const root=fixture(),before=snapshot(root);
assert(compare(before,snapshot(root)).pass);
root.children[0].geometry.scale(1,1,.8);
assert(compare(before,snapshot(root),['Hair']).pass);
assert(!compare(before,snapshot(root)).pass);
root.children[2].position.x=.2;
assert(!compare(before,snapshot(root),['Hair']).pass,'duplicate-name garment must not be lost');
root.children[2].position.x=0;root.children[1].material.opacity=.5;
assert(!compare(before,snapshot(root),['Hair']).pass,'material changes detected');
const clip=()=>new THREE.AnimationClip('Idle',1,[new THREE.NumberKeyframeTrack('.rotation[x]',[0,1],[0,.1])]);
assert(compare(snapshot(root,[clip()]),snapshot(root,[clip()])).pass,'random clip UUID is not a content change');
const other=clip();other.tracks[0].values[1]=.3;
assert(!compare(snapshot(root,[clip()]),snapshot(root,[other])).pass);
root.children[0].material.map=new THREE.Texture();assert.throws(()=>snapshot(root),/texture/i);
console.log('PASS: allowed edits, protected geometry/transform/material, duplicate names, clip content, unsupported texture guard');
