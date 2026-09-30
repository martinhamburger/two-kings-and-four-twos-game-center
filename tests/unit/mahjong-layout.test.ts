import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getMahjongLayout, localToWorld, projectMahjongPoint, projectMahjongBox, saveRiverAnchor, restoreRiverAnchor} from '../../lib/mahjong/layout.ts';

const viewports = [[1920,1080],[1600,900],[1440,900],[1956,1808],[820,900],[640,720],[844,390],[390,844],[320,700],[320,568],[500,550],[580,700],[640,1000],[600,620]];

test('the compact phone layout follows the same width and orientation boundary as the controls',()=>{
 assert.equal(getMahjongLayout(500,550).mode,'portrait');
 assert.equal(getMahjongLayout(580,700).mode,'portrait');
 assert.equal(getMahjongLayout(580,580).mode,'compact');
 assert.equal(getMahjongLayout(581,700).mode,'compact');
 assert.equal(getMahjongLayout(640,1000).mode,'compact');
 assert.equal(getMahjongLayout(600,620).mode,'compact');
});

test('short landscape portraits clear the menu, own portrait and vertical toolbar',()=>{
 const layout=getMahjongLayout(844,390),{west,east,south}=layout.portraits;
 assert(west.y>=64,'the left portrait starts below the menu and its clearance');
 assert(west.y+west.width+68+12<=south.y,'a three-line opponent name stays above the own avatar');
 assert.equal(east.y,west.y,'side portraits remain symmetric');
 assert(east.y+east.width+68+12<=390*.5,'the east name stays above the tools');
 assert.equal(layout.racks.west.tileW,16.900000000000002);
 assert.equal(layout.racks.east.tileW,16.900000000000002);
});

test('one camera makes near objects larger and height moves a tile above the felt',()=>{
 const camera=getMahjongLayout(1600,900).camera;
 const far=projectMahjongPoint({x:100,y:-250},camera),near=projectMahjongPoint({x:100,y:250},camera);
 assert(near.scale>far.scale);
 assert(near.x-camera.cx>far.x-camera.cx);
 assert(projectMahjongPoint({x:0,y:0,z:58},camera).y<camera.cy);
 assert.equal(projectMahjongPoint({x:0,y:0},camera).x,camera.cx);
});

test('seat rotations share a coordinate system and full depth affects projected bounds',()=>{
 const point=localToWorld({x:10,y:0,z:5},{x:20,y:30,angle:90});
 assert.equal(point.x,20);assert.equal(point.y,40);assert.equal(point.z,5);
 const camera=getMahjongLayout(1600,900).camera;
 const face=projectMahjongBox({x:50,y:100,width:36,height:51},camera);
 const solid=projectMahjongBox({x:50,y:100,width:36,height:51,depth:9},camera);
 assert(solid.y<face.y);assert(solid.right>face.right);
 for(const angle of [0,90,180,-90]){
  const bounds=projectMahjongBox({x:0,y:0,width:36,height:51,depth:9,angle},camera);
  assert(bounds.width>0&&bounds.height>0);
 }
});

test('viewport layouts retain 14 stable hand slots, positive world dimensions and safe self controls',()=>{
 for(const [width,height] of viewports){
  const layout=getMahjongLayout(width,height),self=layout.selfRack;
  assert.deepEqual(layout,getMahjongLayout(width,height),'only resizing changes anchors');
  assert(self.drawGap>=3,'the independent drawn slot keeps a visible gap on phones too');
  assert.equal(self.capacity,14);assert.equal(self.columns*self.rows,14);
  assert(self.x>=0&&self.x+self.width<=width);
  assert(self.y-self.lift>=0&&self.y+self.height<=height);
  assert(self.tileW>=19&&self.tileH>self.tileW);
  assert(self.rows===1||self.rowGap>=self.lift+11,'lifting the second row and its thickness must not cover the first row');
  for(const rack of Object.values(layout.racks)){
   assert.equal(rack.handCapacity,14);
   assert(rack.length>=rack.tileW*14);
   // Losing three concealed tiles creates sufficient room for a four-tile kong slot.
   assert(rack.meldSlotWidth<3*(rack.tileW+rack.gap));
  }
  for(const river of Object.values(layout.rivers)){
   assert(river.columns>=5&&river.rows>=2);
   assert(river.width>0&&river.height>0&&river.tileD>0);
   assert(Math.abs(river.rowPitch-river.tileH-river.gapY)<1e-8);
  }
 }
});

test('four river panels form a tight ring without overlapping at the corners',()=>{
 for(const [width,height] of viewports){
  const layout=getMahjongLayout(width,height);
  const boxes=Object.values(layout.rivers).map(river=>{
   const a=localToWorld({x:0,y:0},river),b=localToWorld({x:river.width,y:river.height},river);
   return {left:Math.min(a.x,b.x),right:Math.max(a.x,b.x),top:Math.min(a.y,b.y),bottom:Math.max(a.y,b.y)};
  });
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
   const a=boxes[i],b=boxes[j];
   assert(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top,`${width}x${height}: river panels overlap`);
  }
 }
});

test('projected concealed racks and four south meld slots stay visible and above lifted self tiles',()=>{
 for(const [width,height] of viewports){
  const layout=getMahjongLayout(width,height);
  const concealed=Object.values(layout.racks).map(rack=>projectMahjongBox({
   ...rack,width:rack.length,height:rack.tileD,depth:rack.tileH,
  },layout.camera));
  const melds=projectMahjongBox({...layout.southMeld,depth:layout.southMeld.tileD},layout.camera);
  for(const bounds of [...concealed,melds]){
   assert(bounds.x>=0&&bounds.right<=width&&bounds.y>=0,`${width}x${height}: projected tile body leaves the screen`);
   assert(bounds.bottom<layout.selfRack.y-layout.selfRack.lift,`${width}x${height}: public tiles intersect raised hand`);
  }
 }
});

test('finished hands and three-line name blocks have separate screen space',()=>{
 const overlaps=(a:{x:number;y:number;width:number;height:number},b:{x:number;y:number;width:number;height:number})=>a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;
 for(const [width,height] of viewports){
  const layout=getMahjongLayout(width,height);
  const racks=Object.values(layout.racks).flatMap(r=>[
   projectMahjongBox({...r,width:r.length,height:r.tileD,depth:r.tileH},layout.camera),
   projectMahjongBox({...r,width:r.length,height:r.tileH,depth:r.tileD},layout.camera),
  ]);
  for(const bounds of racks)assert(bounds.x>=13.9&&bounds.right<=width-13.9&&bounds.y>=0&&bounds.bottom<layout.selfRack.y-layout.selfRack.lift,`${width}x${height}: finished or standing body clipped`);
  for(const [seat,p] of Object.entries(layout.portraits)){
   const rect={x:seat==='east'?p.x+p.width-p.nameWidth:seat==='north'?p.x+(p.width-p.nameWidth)/2:p.x,y:p.y,width:p.nameWidth,height:p.width+68};
   assert(rect.x>=0&&rect.x+rect.width<=width,`${width}x${height}: ${seat} name clipped`);
   for(const bounds of racks)assert(!overlaps(rect,bounds),`${width}x${height}: ${seat} portrait overlaps tiles`);
  }
 }
});

test('public bodies end before the action band and wide viewports enlarge the foreground hand',()=>{
 for(const [width,height] of viewports){
  const layout=getMahjongLayout(width,height);
  const publicBodies=[...Object.values(layout.rivers).map(r=>projectMahjongBox({...r,depth:r.tileD},layout.camera)),projectMahjongBox({...layout.southMeld,depth:layout.southMeld.tileD},layout.camera)];
  for(const bounds of publicBodies)assert(bounds.bottom<=layout.actionsY-(layout.mode!=='landscape'?58.9:11.9),`${width}x${height}: public body intersects tools or actions`);
 }
 assert(getMahjongLayout(1956,1808).selfRack.tileW>getMahjongLayout(1600,900).selfRack.tileW);
});

test('solid tile bodies in concealed, revealed and four-kong groups never cross other groups',()=>{
 for(const [width,height] of viewports){
  const layout=getMahjongLayout(width,height);
  const groups:Record<string,ReturnType<typeof projectMahjongBox>[]>= {};
  const tile=(placement:{x:number;y:number;angle:number},x:number,y:number,w:number,h:number,d:number)=>{
   const origin=localToWorld({x,y},placement);
   return projectMahjongBox({x:origin.x,y:origin.y,width:w,height:h,depth:d,angle:placement.angle},layout.camera);
  };
  for(const [seat,r] of Object.entries(layout.racks)){
   const bodies:ReturnType<typeof projectMahjongBox>[]=[];
   groups[`rack-${seat}`]=bodies;
   for(let i=0;i<14;i++){
    const x=i*(r.tileW+r.gap)+(i===13?r.drawGap:0);
    bodies.push(tile(r,x,0,r.tileW,r.tileD,r.tileH),tile(r,x,0,r.tileW,r.tileH,r.tileD));
   }
   for(let group=0;group<4;group++)for(let i=0;i<4;i++)bodies.push(tile(r,r.length-(group+1)*r.meldSlotWidth+i*(r.meldW+r.meldGap/4),0,r.meldW,r.meldH,r.meldD));
  }
  for(const [seat,r] of Object.entries(layout.rivers)){
   const bodies:ReturnType<typeof projectMahjongBox>[]=[];
   groups[`river-${seat}`]=bodies;
   for(let row=0;row<r.rows;row++)for(let col=0;col<r.columns;col++)bodies.push(tile(r,col*(r.tileW+r.gapX),row*r.rowPitch,r.tileW,r.tileH,r.tileD));
  }
  const south=layout.southMeld;
  groups['south-melds']=[];
  for(let group=0;group<4;group++)for(let i=0;i<4;i++)groups['south-melds'].push(tile(south,south.width-(group%south.columns+1)*south.slotWidth+i*(south.tileW+south.gap/4),Math.floor(group/south.columns)*south.rowPitch,south.tileW,south.tileH,south.tileD));
  if(layout.mode!=='landscape'){
   groups['four-tool-buttons']=[{x:width-209,y:layout.actionsY-47,width:197,height:44,right:width-12,bottom:layout.actionsY-3}];
  }else{
   const short=height<=500,toolW=short?44:46,toolH=short?182:214;
   const right=width*(short?.98:.976),top=height*(short?.5:.56);
   groups['four-tool-buttons']=[{x:right-toolW,y:top,width:toolW,height:toolH,right,bottom:top+toolH}];
  }
  if(layout.mode==='portrait'){
   groups['action-buttons']=[{x:62,y:layout.actionsY+7,width:width-74,height:44,right:width-12,bottom:layout.actionsY+51}];
  }else{
   const short=height<=500,center=width*(short?.505:.51),span=layout.mode==='landscape'?Math.min(short?360:500,width*(short?.67:.70)):width*.70,left=layout.mode==='landscape'?center-span/2:width*.16,right=layout.mode==='landscape'?center+span/2:width*.86,top=layout.actionsY+(short?0:10);
   groups['action-buttons']=[{x:left,y:top,width:right-left,height:44,right,bottom:top+44}];
  }
  const self=layout.selfRack;
  groups['self-hand']=[{x:self.x,y:self.y-self.lift,width:self.width,height:self.height+self.lift+10,right:self.x+self.width,bottom:self.y+self.height+10}];
  const entries=Object.entries(groups);
  for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
   const [nameA,as]=entries[i],[nameB,bs]=entries[j];
   for(const a of as)for(const b of bs){
    const overlapW=Math.min(a.right,b.right)-Math.max(a.x,b.x),overlapH=Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y);
    assert(overlapW<=.01||overlapH<=.01,`${width}x${height}: ${nameA} crosses ${nameB} by ${(overlapW*overlapH).toFixed(2)}px`);
   }
  }
 }
});

test('reading anchor keeps its tile and fractional row position across resize and appends',()=>{
 const ids=Array.from({length:36},(_,i)=>100+i);
 const anchor=saveRiverAnchor(ids,120,6,50);
 assert.equal(anchor?.id,112);assert.equal(anchor.index,12);assert(Math.abs(anchor.rowOffset-.4)<1e-8);
 assert.equal(restoreRiverAnchor(anchor,ids,5,40),96);
 assert.equal(restoreRiverAnchor(anchor,[...ids,136,137],5,40),96);
 assert.equal(restoreRiverAnchor(anchor,ids.filter(id=>id!==112),5,40),96);
 assert.equal(restoreRiverAnchor(null,ids,5,40),0);
 assert.equal(saveRiverAnchor([],0,6,50),null);
 assert.equal(restoreRiverAnchor(anchor,[],5,40),0);
});

test('a partially scrolled five-column row stays visible after resizing to six columns',()=>{
 const ids=Array.from({length:30},(_,i)=>i);
 const anchor=saveRiverAnchor(ids,13.5,5,27)!;
 assert.equal(anchor.id,5,'the rounded visual window starts at tile five');
 const restored=restoreRiverAnchor(anchor,ids,6,43);
 assert.equal(restored,0);
 const start=Math.round(restored/43)*6;
 assert(start<=anchor.id&&anchor.id<start+6);
 const oldAnchor={id:5,index:5,rowOffset:.9};
 const oldRestored=restoreRiverAnchor(oldAnchor,ids,6,43);
 assert.equal(Math.round(oldRestored/43),0,'a legacy fractional offset cannot skip the saved tile');
});
