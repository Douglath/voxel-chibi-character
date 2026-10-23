import assert from 'node:assert/strict';
import {ear,sleeve,coat,layers,sample,collections,step} from './style-recipes.mjs';
const occupied=(surface,x,y,z)=>surface(x,y,z)!==null;
assert(!occupied(ear(),0,0,0));assert(occupied(ear(),0,0,-.37));
assert(occupied(ear({cupDepth:0}),0,0,0));
assert(occupied(ear({fur:true}),0,-.25,-.18));
assert(!occupied(ear(),0,-.25,-.18));
const xy=cells=>new Set(cells.map(({cell:[x,y]})=>`${x},${y}`));
assert.deepEqual(xy(sample(ear())),xy(sample(ear({fur:true}))),'fur must not widen ear silhouette');
for(const type of ['straight','bishop','long'])assert(!occupied(sleeve({profile:type}),0,-.9,0),'cuff must remain hollow');
const halfWidth=(surface,y)=>Math.max(...sample(surface).filter(c=>Math.abs(c.cell[1]*step-y)<step/2).map(c=>Math.abs(c.cell[0]*step)));
assert(halfWidth(sleeve(),-.3)>halfWidth(sleeve(),-.9)+.2,'bishop sleeve must narrow at cuff');
assert(halfWidth(sleeve({profile:'long'}),-.9)>halfWidth(sleeve({profile:'long'}),.7)+.2);
assert(!occupied(coat(),0,-.5,.4));assert(occupied(coat(),0,.9,.35));
assert(halfWidth(layers(),-.15)>halfWidth(layers(),-.225),'upper tier must project beyond next tier');
for(const group of Object.values(collections))for(const [name,surface]of group.items){
 const cells=sample(surface),set=new Set(cells.map(c=>c.cell.join(','))),seen=new Set(),queue=[cells[0].cell];
 while(queue.length){const c=queue.pop(),key=c.join(',');if(seen.has(key))continue;seen.add(key);for(let a=0;a<3;a++)for(const d of [-1,1]){const n=[...c];n[a]+=d;if(set.has(n.join(','))&&!seen.has(n.join(',')))queue.push(n)}}
 assert.equal(seen.size,set.size,name+' disconnected voxels');
}
console.log('PASS: 12 connected examples; recessed ear, fur silhouette, hollow cuffs, sleeve profiles, open coat and projecting tiers');
