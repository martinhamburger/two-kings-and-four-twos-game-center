import './sites-env.mjs';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {globSync,readFileSync} from 'node:fs';
import {timeoutModern} from '../lib/mahjong/modern.ts';
import {hints} from '../lib/game/engine.ts';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, mkdtempSync, openSync, closeSync, writeFileSync } from 'node:fs';
import { once } from 'node:events';

// A fresh local database for every run. There is deliberately no remote URL option.
// D1 adds a long content-addressed filename beneath this directory; keep the
// unique segment short enough for Windows workspaces nested under Codex paths.
mkdirSync('.wrangler', { recursive: true });
const state = mkdtempSync('.wrangler/s');
mkdirSync('work', { recursive: true });
const logPath = 'work/smoke-local.log', log = openSync(logPath, 'w');
const migrate = spawnSync(process.execPath, ['scripts/setup-local.mjs', '--state', state], { stdio: ['ignore', log, log] });
if (migrate.status !== 0) { closeSync(log); throw Error(`本地测试数据库初始化失败，见 ${logPath}`); }
const probe = createServer();
probe.listen(0, '127.0.0.1');
await once(probe, 'listening');
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['scripts/preview.mjs', '--port', String(port), '--state', state], { stdio: ['ignore', log, log], env: {...process.env,LOCAL_DEV_TOOLS:'0'} });
const exited = once(child, 'exit');
let startupError;
child.on('error', error => { startupError = error; });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let checks = 0;
async function request(path, data, cookie = '', expected = 200) {
  const response = await fetch(origin + path, {
    method: data ? 'POST' : 'GET', signal: AbortSignal.timeout(30_000),
    headers: { Origin: origin, ...(data ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  assert.equal(response.status, expected, `${path}: HTTP ${response.status}`);
  checks++;
  return { data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] || cookie };
}
try {
  let ready = false;
  for (let n = 0; n < 120; n++) {
    if (startupError) throw startupError;
    if (child.exitCode !== null) throw Error(`预览启动失败，见 ${logPath}`);
    try { if ((await fetch(origin + '/api/auth', { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch {}
    await pause(500);
  }
  assert(ready, '正式产物未能在 60 秒内启动');
  for (const path of ['/', '/mahjong', '/holdem', '/history', '/emotes']) {
    const page = await fetch(origin + path, { signal: AbortSignal.timeout(30_000) });
    assert.equal(page.status, 200, path);
    assert((await page.text()).includes('</html>'), path);
    checks++;
  }
  assert.equal((await request('/api/auth')).data.user, null);
  await request('/api/history', undefined, '', 401);
  const signup = async name => request('/api/auth', { action: 'register', username: name, name: '本地验收', password: crypto.randomUUID() });
  const outsider = await signup('outside' + Date.now().toString(36));
  // Friend requests are mutual and restricted to actual same-table human members.
  await request('/api/friends',undefined,'',401);
  const friendA=await signup('frienda'+Date.now().toString(36)),friendB=await signup('friendb'+Date.now().toString(36)),friendC=await signup('friendc'+Date.now().toString(36));
  const a=friendA.data.user.id,b=friendB.data.user.id,c=friendC.data.user.id;
  let socialRoom=(await request('/api/game',{action:'create',title:'好友验收'},friendA.cookie)).data;
  await request('/api/friends',{action:'request',target:b,code:socialRoom.code},friendA.cookie,403);
  socialRoom=(await request('/api/game',{action:'join',code:socialRoom.code},friendB.cookie)).data;
  await request('/api/friends',{action:'request',target:a,code:socialRoom.code},friendA.cookie,400);
  await request('/api/friends',{action:'request',target:b,code:socialRoom.code},friendA.cookie);
  await request('/api/friends',{action:'request',target:b,code:socialRoom.code},friendA.cookie);
  assert.equal((await request('/api/friends',undefined,friendB.cookie)).data.incoming.length,1,'重复申请不能重复建关系');
  await request('/api/friends',{action:'accept',target:b},friendA.cookie,403);
  await request('/api/friends',{action:'accept',target:a},outsider.cookie,409);
  await request('/api/friends',{action:'invite',target:b,code:socialRoom.code},friendA.cookie,403);
  await request('/api/friends',{action:'accept',target:a},friendB.cookie);
  await request('/api/friends',{action:'heartbeat'},friendB.cookie);
  const privateFriends=(await request('/api/friends',undefined,friendA.cookie)).data;
  assert.equal(privateFriends.friends[0].id,b);assert.equal(privateFriends.friends[0].online,true);
  assert.equal('username' in privateFriends.friends[0],false);
  assert.equal((await request('/api/friends',undefined,outsider.cookie)).data.friends.length,0);
  socialRoom=(await request('/api/game',{action:'join',code:socialRoom.code},friendC.cookie)).data;
  // Avatar versions and data are independent from rooms, with atomic compare-and-swap.
  const avatarBytes=readFileSync(new URL('../tests/fixtures/avatar.jpg',import.meta.url));
  async function avatar(method,cookie,version,bytes=avatarBytes,expected=200,extra={}){
    const r=await fetch(origin+'/api/profile/avatar',{method,headers:{Origin:origin,Cookie:cookie,'Content-Type':'image/jpeg','If-Match':String(version),...extra},...(method==='PUT'?{body:bytes}:{})});const payload=await r.text();assert.equal(r.status,expected,payload);checks++;return JSON.parse(payload);
  }
  await request('/api/profile/avatar',undefined,'',401);
  await avatar('PUT','',0,avatarBytes,401);
  await avatar('PUT',friendA.cookie,0,avatarBytes,403,{Origin:'https://foreign.invalid'});
  await avatar('PUT',friendA.cookie,0,Buffer.from('<svg/>'),400);
  await avatar('PUT',friendA.cookie,0,Buffer.alloc(65537),413);
  assert.equal((await request('/api/profile/avatar',undefined,friendA.cookie)).data.version,0,'超限请求不得写入头像');
  await avatar('PUT',friendA.cookie,0,avatarBytes,400,{'Content-Type':'image/png'});
  let portrait=await avatar('PUT',friendA.cookie,0);assert.equal(portrait.version,1);assert.equal(portrait.id,a);
  const image=await fetch(origin+portrait.url,{headers:{Cookie:friendB.cookie}});assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/jpeg');assert((await image.arrayBuffer()).byteLength<=65536);checks++;
  assert.equal((await fetch(origin+portrait.url)).status,401);checks++;
  const snapshots=(await request('/api/friends',{action:'heartbeat'},friendB.cookie)).data;assert(snapshots.profiles.some(p=>p.id===a&&p.version===1));assert(snapshots.profiles.every(p=>!('image' in p)));
  const concurrent=await Promise.all([1,2].map(()=>fetch(origin+'/api/profile/avatar',{method:'PUT',headers:{Origin:origin,Cookie:friendA.cookie,'Content-Type':'image/jpeg','If-Match':'1'},body:avatarBytes})));assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);checks+=2;
  await avatar('DELETE',friendA.cookie,1,undefined,409);portrait=await avatar('DELETE',friendA.cookie,2);assert.equal(portrait.version,3);assert.equal(portrait.url,null);
  await avatar('PUT',friendB.cookie,0);assert.equal((await request('/api/profile/avatar',undefined,friendA.cookie)).data.version,3,'其他账号只能修改自己');
  assert.equal((await request('/api/game?room='+socialRoom.code,undefined,friendA.cookie)).data.revision,socialRoom.revision,'头像不推进牌局版本');
  await request('/api/friends',{action:'request',target:c,code:socialRoom.code},friendA.cookie);
  await request('/api/friends',{action:'decline',target:a},friendC.cookie);
  assert.equal((await request('/api/friends',undefined,friendA.cookie)).data.outgoing.length,0);
  await request('/api/friends',{action:'request',target:c,code:socialRoom.code},friendA.cookie);
  await request('/api/friends',{action:'cancel',target:c},friendA.cookie);
  assert.equal((await request('/api/friends',undefined,friendC.cookie)).data.incoming.length,0);
  assert.equal((await request('/api/game?room='+socialRoom.code,undefined,friendA.cookie)).data.revision,socialRoom.revision,'好友操作不得推进牌桌版本');
  await request('/api/game',{action:'leave',code:socialRoom.code,revision:socialRoom.revision},friendC.cookie);
  socialRoom=(await request('/api/game?room='+socialRoom.code,undefined,friendB.cookie)).data;
  await request('/api/game',{action:'leave',code:socialRoom.code,revision:socialRoom.revision},friendB.cookie);
  async function inviteRound(endpoint,room){
    await request('/api/friends',{action:'invite',target:b,code:room.code},friendA.cookie);
    await request('/api/friends',{action:'invite',target:b,code:room.code},friendA.cookie);
    const invitations=(await request('/api/friends',undefined,friendB.cookie)).data.invites;
    assert.equal(invitations.length,1,'重复邀请不能产生多个通知');
    const inviteId=invitations[0].id;
    await request('/api/friends',{action:'open_invite',inviteId},outsider.cookie,409);
    const dest=(await request('/api/friends',{action:'open_invite',inviteId},friendB.cookie)).data;
    assert.equal(dest.code,room.code);
    let joined=(await request(endpoint,{action:'join',code:dest.code},friendB.cookie)).data;
    await request('/api/friends',{action:'dismiss_invite',inviteId},friendB.cookie);
    assert.equal((await request('/api/friends',undefined,friendB.cookie)).data.invites.length,0);
    await request(endpoint,{action:'leave',code:room.code,revision:joined.revision},friendB.cookie);
    const updated=(await request(endpoint+'?room='+room.code,undefined,friendA.cookie)).data;
    await request('/api/friends',{action:'invite',target:b,code:room.code},friendA.cookie);
    const stale=(await request('/api/friends',undefined,friendB.cookie)).data.invites[0].id;
    await request(endpoint,{action:'leave',code:room.code,revision:updated.revision},friendA.cookie);
    await request('/api/friends',{action:'open_invite',inviteId:stale},friendB.cookie,409);
    assert.equal((await request('/api/friends',undefined,friendB.cookie)).data.invites.length,0);
  }
  await inviteRound('/api/game',socialRoom);
  for(const endpoint of ['/api/mahjong','/api/holdem']){
    const created=(await request(endpoint,{action:'create',title:'跨游戏好友邀请'},friendA.cookie)).data;
    await inviteRound(endpoint,created);
  }
  await request('/api/auth',{action:'logout'},friendB.cookie);
  assert.equal((await request('/api/friends',undefined,friendA.cookie)).data.friends[0].online,false,'退出后不能继续显示在线');
  for (const [kind, endpoint, size] of [['landlord', '/api/game', 3], ['mahjong', '/api/mahjong', 4], ['holdem', '/api/holdem', 4]]) {
    const player = await signup(kind + Date.now().toString(36));
    const room = (await request(endpoint, { action: 'create', capacity: size, mode: 'practice', title: '本机自动验收' }, player.cookie)).data;
    assert.equal(room.game.seats.length, size);
    assert.equal(room.game.seats.filter(seat => seat.bot).length, size - 1);
    await request(endpoint + '?room=' + room.code, undefined, outsider.cookie, 403);
    await request('/api/chat?room=' + room.code, undefined, outsider.cookie, 403);
    const message = { code: room.code, clientId: crypto.randomUUID(), kind: 'text', text: '本地测试消息' };
    const first = (await request('/api/chat', message, player.cookie)).data;
    assert.equal((await request('/api/chat', message, player.cookie)).data.id, first.id);
    const after = (await request(endpoint + '?room=' + room.code, undefined, player.cookie)).data;
    assert.equal(after.revision, room.revision, '聊天不能修改牌局版本');
    const emote = { code: room.code, clientId: crypto.randomUUID(), kind: 'emote', emoteId: 'royale-v2-king-laugh' };
    const acknowledged = (await request('/api/chat', emote, player.cookie)).data;
    assert.equal(acknowledged.message.clientId, emote.clientId);
    assert.equal(acknowledged.message.emoteId, emote.emoteId);
    assert.equal(acknowledged.message.own, 1);
    assert.equal(acknowledged.emoteReadyAt, acknowledged.created + 3000);
    assert.equal((await request('/api/chat', emote, player.cookie)).data.message.id, acknowledged.message.id);
    await request('/api/chat', { ...emote, clientId: crypto.randomUUID() }, player.cookie, 429);
    const chat = (await request('/api/chat?room=' + room.code, undefined, player.cookie)).data;
    assert.equal(chat.messages.length, 2);
    assert.equal(chat.messages[1].clientId, emote.clientId);
    assert.equal(chat.messages[1].id, acknowledged.message.id);
    await request('/api/history', undefined, player.cookie);
    await request('/api/admin', undefined, player.cookie, 403);
  }
  // A departing member stays accountable through settlement, then leaves atomically.
  const leavers=await Promise.all([0,1,2,3].map(i=>signup('depart'+i+Date.now().toString(36))));
  let departureRoom=(await request('/api/mahjong',{action:'create',title:'离桌验收'},leavers[0].cookie)).data;
  for(const p of leavers.slice(1))departureRoom=(await request('/api/mahjong',{action:'join',code:departureRoom.code},p.cookie)).data;
  await request('/api/mahjong',{action:'end_table',code:departureRoom.code,revision:departureRoom.revision},leavers[1].cookie,403);
  for(const p of leavers)departureRoom=(await request('/api/mahjong',{action:'ready',code:departureRoom.code,revision:departureRoom.revision},p.cookie)).data;
  const queued=(await request('/api/mahjong',{action:'leave',code:departureRoom.code,revision:departureRoom.revision},leavers[1].cookie)).data;
  assert.equal(queued.left,true);assert.equal(queued.departurePending,true);
  departureRoom=(await request('/api/mahjong?room='+departureRoom.code,undefined,leavers[0].cookie)).data;
  assert.equal(departureRoom.game.phase,'playing');assert.equal(departureRoom.game.seats[1].leaving,true);
  assert.equal((await request('/api/lobby',undefined,leavers[1].cookie)).data.departurePending,true);
  await request('/api/mahjong',{action:'discard',tile:0,code:departureRoom.code,revision:departureRoom.revision},leavers[1].cookie,403);
  await request('/api/mahjong',{action:'end_table',code:departureRoom.code,revision:departureRoom.revision},leavers[2].cookie,403);
  await request('/api/mahjong',{action:'create'},leavers[1].cookie,409);
  // Advance only this isolated fixture to the final timeout; the real API must commit settlement + release.
  const fixtureDb=new DatabaseSync(globSync(state+'/v3/d1/miniflare-D1DatabaseObject/*.sqlite').find(p=>!p.endsWith('metadata.sqlite')));
  fixtureDb.exec('PRAGMA busy_timeout=5000');
  let fixture=JSON.parse(fixtureDb.prepare('SELECT state FROM rooms WHERE code=?').get(departureRoom.code).state),last;
  for(let n=0;n<600&&fixture.phase!=='finished';n++){last=structuredClone(fixture);timeoutModern(fixture,fixture.deadline);}
  assert.equal(fixture.phase,'finished');last.deadline=0;
  fixtureDb.prepare('UPDATE rooms SET state=?,phase=?,revision=revision+1 WHERE code=?').run(JSON.stringify(last),last.phase,departureRoom.code);fixtureDb.close();
  const afterDeparture=(await request('/api/lobby',undefined,leavers[1].cookie)).data;
  assert.equal(afterDeparture.activeRoom,null);assert.equal(afterDeparture.departurePending,false);
  departureRoom=(await request('/api/mahjong?room='+departureRoom.code,undefined,leavers[0].cookie)).data;
  assert.equal(departureRoom.game.phase,'finished');assert.equal(departureRoom.game.seats[1].departed,true);
  assert.deepEqual(departureRoom.game.seats.map(s=>s.balance),fixture.seats.map(s=>s.balance));
  assert.equal(departureRoom.game.result.seats[1].id,leavers[1].data.user.id);
  await request('/api/chat',{code:departureRoom.code,clientId:crypto.randomUUID(),kind:'text',text:'离桌后不能发送'},leavers[1].cookie,403);
  await request('/api/mahjong',{action:'join',code:departureRoom.code},leavers[1].cookie,403);
  await request('/api/mahjong',{action:'ready',code:departureRoom.code,revision:departureRoom.revision},leavers[0].cookie,400);
  const nextRoom=(await request('/api/mahjong',{action:'create'},leavers[1].cookie)).data;
  await request('/api/mahjong?room='+departureRoom.code,undefined,leavers[0].cookie);
  await request('/api/mahjong',{action:'leave',code:departureRoom.code,revision:0},leavers[1].cookie);
  assert.equal((await request('/api/lobby',undefined,leavers[1].cookie)).data.activeRoom,nextRoom.code);
  await request('/api/mahjong',{action:'leave',code:departureRoom.code,revision:departureRoom.revision},leavers[0].cookie);
  departureRoom=(await request('/api/mahjong?room='+departureRoom.code,undefined,leavers[2].cookie)).data;
  assert.equal(departureRoom.game.host,leavers[2].data.user.id);
  await request('/api/mahjong',{action:'end_table',code:departureRoom.code,revision:departureRoom.revision},leavers[3].cookie,403);
  await request('/api/mahjong',{action:'end_table',code:departureRoom.code,revision:departureRoom.revision},leavers[2].cookie);
  const v3Player = await signup('landlordv3' + Date.now().toString(36));
  let v3 = (await request('/api/game', { action: 'create', mode: 'practice', title: 'v3 本机验收', rules: { id: 'landlord-v3' } }, v3Player.cookie)).data;
  assert.equal(v3.game.kind, 'landlord-v3');
  assert.equal(v3.game.developerMode, undefined);
  await request('/api/game', {action:'dev_equipment',code:v3.code,revision:v3.revision,equipmentId:'rocket-win'},v3Player.cookie,400);
  assert.deepEqual(v3.game.coins, ['2', '2', '2']);
  v3 = (await request('/api/game', { action: 'ready', code: v3.code, revision: v3.revision }, v3Player.cookie)).data;
  assert.equal(v3.game.phase, 'shopping');
  assert.equal(v3.game.shops[0].offers.length, 12);
  const offer = v3.game.shops[0].offers[0];
  v3 = (await request('/api/game', { action: 'shop_buy', code: v3.code, revision: v3.revision, offerId: offer.offerId }, v3Player.cookie)).data;
  assert.equal(v3.game.equipment[0].length, 1);
  const afterPurchaseCoins = v3.game.coins[0];
  v3 = (await request('/api/game', { action: 'shop_sell', code: v3.code, revision: v3.revision, instanceId: v3.game.equipment[0][0].instanceId }, v3Player.cookie)).data;
  assert.equal(v3.game.coins[0], afterPurchaseCoins, '一级装备出售不退款；购买找零时可能已经返还金币');
  v3 = (await request('/api/game', { action: 'shop_done', code: v3.code, revision: v3.revision }, v3Player.cookie)).data;
  for (let attempt = 0; attempt < 8 && v3.game.phase !== 'bidding'; attempt++) {
    await pause(1000);
    v3 = (await request('/api/game?room=' + v3.code, undefined, v3Player.cookie)).data;
    assert(['shopping', 'equipment', 'bidding'].includes(v3.game.phase), `V3 开局阶段异常：${v3.game.phase}`);
  }
  assert.equal(v3.game.phase, 'bidding');
  assert.equal(v3.game.seats.filter(seat => seat.bot).length, 2);
  // Four humans keep bot timers out of the preview/turn and stale-version assertions.
  const humans = [];
  for (let i=0;i<4;i++) humans.push(await signup('preselect'+i+Date.now().toString(36)));
  let table=(await request('/api/holdem',{action:'create',capacity:4,seconds:60},humans[0].cookie)).data;
  for(let i=1;i<4;i++) table=(await request('/api/holdem',{action:'join',code:table.code},humans[i].cookie)).data;
  for(const player of humans) table=(await request('/api/holdem',{action:'ready',code:table.code,revision:table.revision},player.cookie)).data;
  const preview=(await request('/api/holdem?room='+table.code,undefined,humans[0].cookie)).data;
  assert.equal(preview.game.options.acting,false);
  assert.equal(preview.game.actionPreview.call,'20');
  assert.equal(preview.game.actionPreview.minRaise,'60');
  assert(preview.game.seats.slice(1).every(s=>s.hand.length===0));
  await request('/api/holdem',{action:'call',code:table.code,revision:table.revision},humans[0].cookie,400);
  assert.equal(preview.game.actionPreview.betStep,'10');
  await request('/api/holdem',{action:'raise',amount:'30',code:table.code,revision:table.revision},humans[3].cookie,400);
  table=(await request('/api/holdem',{action:'raise',amount:'100',code:table.code,revision:table.revision},humans[3].cookie)).data;
  const updated=(await request('/api/holdem?room='+table.code,undefined,humans[0].cookie)).data;
  assert.equal(updated.game.options.acting,true);
  assert.equal(updated.game.actionPreview.call,'90');
  assert.equal(updated.game.actionPreview.minRaise,'170');
  await request('/api/holdem',{action:'call',code:table.code,revision:preview.revision},humans[0].cookie,409);
  const confirmed=(await request('/api/holdem',{action:'call',code:table.code,revision:updated.revision},humans[0].cookie)).data;
  assert.equal(confirmed.game.seats[0].bet,'100');
  assert.equal(confirmed.game.seats[0].total,'100');
  assert.equal(confirmed.game.seats[0].stack,'900');
  assert.equal(confirmed.game.seats[0].action.kind,'call');
  assert.equal(confirmed.game.seats[0].action.paid,'90');
  await request('/api/holdem',{action:'call',code:table.code,revision:updated.revision},humans[0].cookie,409);
  const acting=confirmed.game.seats[confirmed.game.turn];
  const timeoutRequest={action:'timeout_choice',code:table.code,revision:confirmed.revision,round:confirmed.game.round,street:confirmed.game.street,bet:acting.bet,stack:acting.stack,choice:{action:'call',maxCall:'80'}};
  const planned=(await request('/api/holdem',timeoutRequest,humans[1].cookie)).data;
  assert.equal(planned.game.seats[1].stack,acting.stack);
  assert(!JSON.stringify(planned.game).includes('timeoutChoice'));
  await request('/api/holdem',{...timeoutRequest,revision:planned.revision,round:'wrong'},humans[1].cookie,400);
  table=(await request('/api/holdem',{...timeoutRequest,revision:planned.revision,choice:null},humans[1].cookie)).data;
  assert.equal(table.game.rules.id,'holdem-v5');
  while(table.game.phase==='playing'){
    const i=table.game.turn,boardBefore=table.game.board;
    table=(await request('/api/holdem',{action:'fold',code:table.code,revision:table.revision},humans[i].cookie)).data;
    if(table.game.phase==='finished')assert.deepEqual(table.game.board,boardBefore);
  }
  assert.equal(table.game.result.type,'fold');
  for(const player of humans){
    const settled=(await request('/api/holdem?room='+table.code,undefined,player.cookie)).data;
    assert(settled.game.seats.every(s=>s.hand.length===2));
    assert(settled.game.result.seats.every(s=>s.hand.length===2&&(settled.game.board.length>=3?s.value!==null:s.value===null)));
  }
  for(const player of humans)table=(await request('/api/holdem',{action:'ready',code:table.code,revision:table.revision},player.cookie)).data;
  const fresh=(await request('/api/holdem?room='+table.code,undefined,humans[0].cookie)).data;
  assert.equal(fresh.game.phase,'playing');assert.equal(fresh.game.result,null);
  assert(fresh.game.seats.slice(1).every(s=>s.hand.length===0));
  // Exercise one real v3 round with fixed humans, production permissions, and a stale write.
  const v3Humans=[];
  for(let i=0;i<3;i++)v3Humans.push(await signup('v3human'+i+Date.now().toString(36)));
  let extended=(await request('/api/game',{action:'create',rules:{id:'landlord-v3'}},v3Humans[0].cookie)).data;
  for(let i=1;i<3;i++)extended=(await request('/api/game',{action:'join',code:extended.code},v3Humans[i].cookie)).data;
  for(let i=0;i<3;i++)extended=(await request('/api/game',{action:'ready',code:extended.code,revision:extended.revision},v3Humans[i].cookie)).data;
  assert.equal(extended.game.phase,'shopping');assert.deepEqual(extended.game.bottom,[-1,-1,-1]);
  const stale=extended.revision;
  extended=(await request('/api/game',{action:'shop_done',code:extended.code,revision:extended.revision},v3Humans[0].cookie)).data;
  await request('/api/game',{action:'shop_done',code:extended.code,revision:stale},v3Humans[1].cookie,409);
  for(let i=1;i<3;i++)extended=(await request('/api/game',{action:'shop_done',code:extended.code,revision:extended.revision},v3Humans[i].cookie)).data;
  for(let turn=0;extended.game.phase==='bidding';turn++){
    assert(turn<4);
    const seat=extended.game.turn;
    extended=(await request('/api/game',{action:'v3_bid',call:false,code:extended.code,revision:extended.revision},v3Humans[seat].cookie)).data;
  }
  for(let turn=0;extended.game.phase!=='finished';turn++){
    assert(turn<200,'V3 should finish a complete hand');
    const seat=extended.game.turn;
    extended=(await request('/api/game?room='+extended.code,undefined,v3Humans[seat].cookie)).data;
    const options=hints(extended.game.seats[seat].hand,extended.game.last?.combo??null);
    extended=(await request('/api/game',{action:options.length?'play':'pass',cards:options[0]??[],code:extended.code,revision:extended.revision},v3Humans[seat].cookie)).data;
  }
  assert(extended.game.coins.every(value=>BigInt(value)>=0n));
  assert.equal(extended.game.roundHistory.length,1);
  await request('/api/game',{action:'leave',code:extended.code,revision:extended.revision},v3Humans[1].cookie);
  for(const player of v3Humans)assert.equal((await request('/api/game',undefined,player.cookie)).data.activeRoom,null);
  await request('/api/game',{action:'join',code:extended.code},outsider.cookie,400);
  const info = (await request('/build-info.json')).data;
  assert.match(info.commit, /^[a-f0-9]{40}$/);
  writeFileSync('work/smoke-local.json', JSON.stringify({ status: 'passed', checks, commit: info.commit, state }, null, 2) + '\n');
  console.log(`正式产物本地验收通过：${checks} 项检查；三游戏、人机补位、账号、聊天权限、重试与限流。`);
} finally {
  child.kill('SIGTERM');
  await Promise.race([exited, pause(5000)]);
  if (child.exitCode === null) child.kill('SIGKILL');
  closeSync(log);
}
