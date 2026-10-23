import assert from 'node:assert/strict';
import {makeParts,earSurface,coatSurface,sleeveSurface} from './part-recipes.mjs';
// Observable structural properties, independent of render colours/counts.
assert.equal(earSurface(0,0,0),null,'ear centre is recessed, not filled to rim');
assert.notEqual(earSurface(0,0,-.34),null,'ear retains back shell');
assert.equal(coatSurface(0,0,.4),null,'open front');
assert.notEqual(coatSurface(0,0,-.4),null,'closed back');
assert.notEqual(coatSurface(0,.8,.4),null,'collar bridges front centre');
assert.notEqual(coatSurface(.3,.6,.4),null);
assert.equal(coatSurface(.3,-.8,.4),null,'opening widens toward hem');
assert.equal(sleeveSurface(0,-.85,0),null,'cuff remains open');
assert.notEqual(sleeveSurface(.58,-.85,0),null,'flared sleeve has walls');
for(const part of makeParts()){
 const set=new Set(part.cells.map(c=>c.cell.join(',')));assert.equal(set.size,part.cells.length);
 const seen=new Set(),queue=[part.cells[0].cell];while(queue.length){const c=queue.pop(),key=c.join(',');if(seen.has(key))continue;seen.add(key);for(let a=0;a<3;a++)for(const d of [-1,1]){const n=[...c];n[a]+=d;if(set.has(n.join(','))&&!seen.has(n.join(',')))queue.push(n)}}
 assert.equal(seen.size,set.size,part.label+' must be connected');
}
console.log('PASS: recessed ear, open/flared coat, continuous collar, hollow sleeve; all voxel examples connected');
