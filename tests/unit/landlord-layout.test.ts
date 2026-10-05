import test from 'node:test';
import assert from 'node:assert/strict';
import {landlordHandLayout,playedCardsLayout,landlordFrame} from '../../lib/game/table-layout.ts';
import {brushSelection} from '../../lib/game/selection.ts';
import {virtualCard} from '../../lib/game/engine.ts';
import {EQUIPMENT_ICONS,equipmentIcon} from '../../lib/game/equipment-presentation.ts';
import {DEFAULT_LANDLORD_V3_RULES} from '../../lib/game/landlord-v3.ts';

test('fixed hand widths, spacing and row capacity survive 21→20, 33→32 and 2→1',()=>{
 for(const width of [288,358,992,1133,1425,1888])for(const mode of ['ordinary','four','skill'] as const){
  for(const [before,after] of [[21,20],[33,32],[2,1]]){const a=landlordHandLayout(before,width,mode),b=landlordHandLayout(after,width,mode);for(const key of ['cardWidth','step','perRow','capacity','rankSize'] as const)assert.equal(a[key],b[key]);}
  const l=landlordHandLayout(33,width,mode);assert(l.cardWidth+(l.perRow-1)*l.step<=width+.01);assert(l.step>=20);
 }
});
test('desktop frame leaves independent central, control and hand slots at every target size',()=>{
 for(const [width,height] of [[1024,600],[1165,610],[1457,763],[1920,1080]]){const f=landlordFrame(height);assert.equal(f.toolbar,48);assert.equal(f.hud,36);assert.equal(f.controls,52);assert.equal(f.hand,164);assert(f.arena>=272);assert.equal(Object.values(f).reduce((a,b)=>a+b,0),height);const l=landlordHandLayout(33,width-32,'four');assert.equal(l.rows,1);const skill=landlordHandLayout(54,width-32,'skill');assert.equal(skill.rows,2);assert(skill.cardWidth*3+28<=f.hand);}
});
test('long plays show every card within two rows without horizontal scrolling',()=>{
 for(const width of [90,240,320,460])for(const count of [1,8,12,20,30,33]){const l=playedCardsLayout(count,width,80);assert(l.cardWidth+(l.perRow-1)*l.step<=width+.01);assert(l.rows*l.cardWidth*1.5+(l.rows-1)*4<=80);assert(l.rows*l.perRow>=count);}
});
test('visually identical physical and copied cards retain separate selected IDs',()=>{
 const ids=[0,1,54,55,virtualCard(3,1),virtualCard(3,2)];let selected:number[]=[];selected=brushSelection(selected,ids,true,new Set());assert.deepEqual(selected,ids);selected=brushSelection(selected,[54,ids[4]],false,new Set());assert.deepEqual(selected,[0,1,55,ids[5]]);
});
test('equipment has explicit icons and family upgrades retain their icon',()=>{
 for(const e of DEFAULT_LANDLORD_V3_RULES.equipmentCatalog)assert(e.id in EQUIPMENT_ICONS,e.id);
 for(const family of ['copy','bomb'])for(let i=2;i<=4;i++)assert.equal(equipmentIcon(`${family}-${i}`),equipmentIcon(`${family}-1`));
});
