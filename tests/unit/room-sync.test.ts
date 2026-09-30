import test from 'node:test';
import assert from 'node:assert/strict';
import {createSerialPoller,roomPollInterval} from '../../lib/sync/poller.ts';
import {newerRoom} from '../../lib/sync/snapshot.ts';
import {createRoomTiming,remainingSeconds} from '../../lib/sync/clock.ts';

function clock(){
 let now=0,id=0;const timers=new Map<number,{at:number;fn:()=>void}>();
 const env={now:()=>now,setTimer:(fn:()=>void,ms:number)=>{const key=++id;timers.set(key,{at:now+ms,fn});return key as unknown as ReturnType<typeof setTimeout>;},clearTimer:(key:ReturnType<typeof setTimeout>)=>{timers.delete(key as unknown as number);}};
 async function advance(ms:number){const end=now+ms;for(let guard=0;guard<1000;guard++){await Promise.resolve();await Promise.resolve();const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}now=end;await Promise.resolve();await Promise.resolve();}
 return {env,advance};
}

test('combined polling stays within 60 active / 20 waiting reads per minute and stops while hidden',async()=>{
 for(const phase of ['playing','shopping','equipment','waiting','finished']){
  const c=clock(),starts:number[]=[];
  const poller=createSerialPoller({...c.env,task:async()=>{starts.push(c.env.now());},interval:()=>roomPollInterval(phase),onError:()=>assert.fail('unexpected error')});
  poller.resume(true);await c.advance(59999);
  assert.equal(starts.length,roomPollInterval(phase)===1000?60:20);
  poller.pause();const count=starts.length;await c.advance(60000);assert.equal(starts.length,count);
  poller.resume(true);await c.advance(0);assert.equal(starts.length,count+1);poller.stop();
 }
});

test('slow reads are serial and late responses cannot overwrite a mutation or another room',async()=>{
 const c=clock();let resolve!:()=>void;let requests=0,accepted=0;
 const poller=createSerialPoller({...c.env,task:async(_signal,current)=>{requests++;await new Promise<void>(done=>resolve=done);if(current())accepted++;},interval:()=>1000,onError:()=>assert.fail('unexpected')});
 poller.resume(true);await c.advance(5000);assert.equal(requests,1);
 poller.pause();poller.resume();resolve();await c.advance(0);assert.equal(accepted,0);
 await c.advance(1000);assert.equal(requests,2);
 poller.stop();resolve();await c.advance(5000);assert.equal(accepted,0);assert.equal(requests,2);
});

test('a successful POST resumes on the next interval; recovery requests coalesce',async()=>{
 const c=clock();let count=0;
 const poller=createSerialPoller({...c.env,task:async()=>{count++;},interval:()=>1000,onError:()=>{}});
 poller.resume(true);await c.advance(0);assert.equal(count,1);
 poller.pause();poller.resume();await c.advance(999);assert.equal(count,1);await c.advance(1);assert.equal(count,2);
 poller.refresh();poller.refresh();await c.advance(0);assert.equal(count,3);poller.stop();
});

test('a stalled request times out, reports once, and recovers without retrying a mutation',async()=>{
 const c=clock();let calls=0,errors=0;
 const poller=createSerialPoller({...c.env,task:async signal=>{calls++;if(calls===1)await new Promise<void>((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));},interval:()=>1000,onError:()=>{errors++;}});
 poller.resume(true);await c.advance(11999);assert.equal(calls,1);assert.equal(errors,0);
 await c.advance(1);assert.equal(errors,1);await c.advance(1999);assert.equal(calls,1);await c.advance(1);assert.equal(calls,2);poller.stop();
});

test('errors back off and a foreground refresh resets the failure delay',async()=>{
 const c=clock(),starts:number[]=[];let failing=true;
 const poller=createSerialPoller({...c.env,task:async()=>{starts.push(c.env.now());if(failing)throw Error('offline');},interval:()=>1000,onError:()=>{}});
 poller.resume(true);await c.advance(14000);assert.deepEqual(starts,[0,2000,6000,14000]);
 failing=false;poller.pause();poller.resume(true);await c.advance(0);await c.advance(1000);assert.equal(starts.at(-1),15000);poller.stop();
});

test('unchanged snapshots retain identity and clock corrections are independent',()=>{
 const before={code:'123456',revision:8,game:{hand:[1,2]}};
 assert.equal(newerRoom(before,{...before,game:{hand:[1,2]}}),before);
 assert.equal(newerRoom(before,{...before,revision:7}),before);
 assert.equal(newerRoom(before,{...before,revision:9}).revision,9);
 assert.equal(newerRoom(before,{...before,code:'654321',revision:0}).code,'654321');
 const timing=createRoomTiming();timing.update(1200,1000);assert.equal(remainingSeconds(5200,2000,timing.offset()),3);
 timing.update(1100,1000);assert.equal(remainingSeconds(5200,2200,timing.offset()),3);
 assert.equal(remainingSeconds(5200,6000,timing.offset()),0);
});
