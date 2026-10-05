import test from 'node:test';
import assert from 'node:assert/strict';
import {landlordHandLayout,playedCardsLayout,landlordFrame} from '../../lib/game/table-layout.ts';
import {brushSelection} from '../../lib/game/selection.ts';
import {virtualCard} from '../../lib/game/engine.ts';
import {EQUIPMENT_ICONS,equipmentIcon} from '../../lib/game/equipment-presentation.ts';
import {DEFAULT_LANDLORD_V3_RULES} from '../../lib/game/landlord-v3.ts';

test('fixed hand sizes and row capacity survive 21→20, 33→32 and 2→1',()=>{
 for(const height of [164,208])for(const width of [288,358,992,1133,1425,1888])for(const mode of ['ordinary','four','skill'] as const){
  for(const [before,after] of [[21,20],[33,32],[2,1]]){const a=landlordHandLayout(before,width,mode,height),b=landlordHandLayout(after,width,mode,height);for(const key of ['cardWidth','cardHeight','perRow','capacity'] as const)assert.equal(a[key],b[key]);}
  const l=landlordHandLayout(33,width,mode);assert(l.cardWidth+(Math.min(33,l.perRow)-1)*l.step<=width+.01);assert(l.step>=20);
 }
});
test('desktop frame leaves independent central, control and hand slots at every target size',()=>{
 for(const [width,height] of [[1024,600],[1165,610],[1457,763],[1920,1080]]){const f=landlordFrame(height);assert.equal(f.toolbar,48);assert(f.hud>=36&&f.hud<=40);assert(f.controls>=56&&f.controls<=64);assert(f.hand>=164&&f.hand<=208);assert(f.arena>=288);assert.equal(Object.values(f).reduce((a,b)=>a+b,0),height);const l=landlordHandLayout(33,width-32,'four',f.hand);assert.equal(l.rows,1);const skill=landlordHandLayout(54,width-32,'skill',f.hand);assert.equal(skill.rows,2);assert(skill.cardHeight*2+28<=f.hand);assert(skill.cardWidth>=48);}
});
test('long plays show every card within two rows without horizontal scrolling',()=>{
 for(const height of [60,80,112,180])for(const width of [90,240,320,460])for(const count of [1,8,12,20,30,33]){const l=playedCardsLayout(count,width,height);assert(l.cardWidth+(l.perRow-1)*l.step<=width+.01);assert(l.rows*l.cardWidth*1.5+(l.rows-1)*4<=height);assert(l.rows*l.perRow>=count);}
});
test('visually identical physical and copied cards retain separate selected IDs',()=>{
 const ids=[0,1,54,55,virtualCard(3,1),virtualCard(3,2)];let selected:number[]=[];selected=brushSelection(selected,ids,true,new Set());assert.deepEqual(selected,ids);selected=brushSelection(selected,[54,ids[4]],false,new Set());assert.deepEqual(selected,[0,1,55,ids[5]]);
});
test('equipment has explicit icons and family upgrades retain their icon',()=>{
 for(const e of DEFAULT_LANDLORD_V3_RULES.equipmentCatalog)assert(e.id in EQUIPMENT_ICONS,e.id);
 for(const family of ['copy','bomb'])for(let i=2;i<=4;i++)assert.equal(equipmentIcon(`${family}-${i}`),equipmentIcon(`${family}-1`));
});

test('short desktop play zones use their width before shrinking long cards into two tiny rows',()=>{const compact=playedCardsLayout(25,353,62);assert.equal(compact.rows,1);assert(compact.cardWidth>=35);assert.equal(playedCardsLayout(25,353,150).rows,2);});

test('illustrated hands spread by current count, fill available width and keep at least half overlap',()=>{
 for(const width of [288,992,1133,1425,1888])for(const mode of ['ordinary','four'] as const)for(const count of [1,2,9,20,21,25,32,33]){
  const l=landlordHandLayout(count,width,mode,208),rowCount=Math.min(count,l.perRow),used=l.cardWidth+(rowCount-1)*l.step;
  assert(l.step<=l.cardWidth*.5);assert(used<=width+.01);
  if(rowCount>1)assert(Math.abs(used-width)<.01||l.step===l.cardWidth*.5);
 }
 const full=landlordHandLayout(33,1425,'four',208),reduced=landlordHandLayout(25,1425,'four',208);
 assert(reduced.step>full.step);assert.equal(reduced.cardWidth,full.cardWidth);assert.equal(reduced.cardWidth+24*reduced.step,1425);
});
