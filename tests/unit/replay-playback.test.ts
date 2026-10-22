import assert from 'node:assert/strict';
import test from 'node:test';
import {replayStepPositions,replayTimeline} from '../../lib/replay/playback.ts';
import type {ReplayFrame,ReplayEvent} from '../../lib/replay/types.ts';

test('seeking uses game steps even with dense chat and messages after the final action',()=>{
 const frames:ReplayFrame[]=[100,200,300].map(at=>({at,action:String(at),scene:{game:'landlord',phase:'playing',seats:[]}}));
 const events:ReplayEvent[]=[350,120,200,110,130].map((at,id)=>({at,id,seat:0,kind:'text',text:String(id)}));
 const moments=replayTimeline(frames,events),positions=replayStepPositions(moments);
 assert.deepEqual(positions,[0,4,6]);
 assert.deepEqual(positions.map(i=>moments[i].frameIndex),[0,1,2]);
 assert.deepEqual(moments.filter(m=>m.event).map(m=>[m.event!.at,m.frameIndex]),[[110,0],[120,0],[130,0],[200,1],[350,2]]);
 assert.equal(moments.at(-1)?.event?.at,350);
 assert.deepEqual(events.map(e=>e.at),[350,120,200,110,130]);
});

test('same-time messages retain deterministic order and pre-round messages stay outside the replay',()=>{
 const frames:ReplayFrame[]=[100,100,200].map(at=>({at,action:'结果',scene:{game:'mahjong',phase:'playing',seats:[]}}));
 const events:ReplayEvent[]=[{id:3,at:100,seat:0,kind:'emote'},{id:2,at:100,seat:1,kind:'text'},{id:1,at:99,seat:0,kind:'text'}];
 const moments=replayTimeline(frames,events);
 assert.deepEqual(moments.filter(m=>m.event).map(m=>[m.event!.id,m.frameIndex]),[[2,1],[3,1]]);
 assert.deepEqual(replayTimeline([],events),[]);
 assert.deepEqual(replayStepPositions([]),[]);
});
