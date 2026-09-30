import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {globSync} from 'node:fs';
import {newModern,modernSeat} from '../lib/mahjong/modern.ts';

export async function verifyReportApis({request,signup,state,outsider,extended,v3Humans}){
 const player=await signup('report'+Date.now().toString(36)),uid=player.data.user.id,db=new DatabaseSync(globSync(state+'/v3/d1/miniflare-D1DatabaseObject/*.sqlite').find(p=>!p.endsWith('metadata.sqlite')));
 db.exec('PRAGMA busy_timeout=5000');
 const roomCode='123456',now=Date.now(),names=['战报测试','同名','同名'],ids=[uid,'synthetic-b','synthetic-c'];
 const insertRoom=db.prepare('INSERT INTO rooms (code,title,state,phase,revision,op,created,updated) VALUES (?,?,?,\'closed\',1,?, ?,?)');
 const insertRound=db.prepare('INSERT INTO records (id,room_code,result,created) VALUES (?,?,?,?)');
 insertRoom.run(roomCode,'历史空座位战报',JSON.stringify({phase:'closed',seats:[]}),crypto.randomUUID(),now,now);
 for(let i=0;i<25;i++)insertRound.run('report-'+String(i).padStart(3,'0'),roomCode,JSON.stringify({kind:'landlord',seats:ids.map((id,n)=>({id,name:names[n],delta:[6,-3,-3][n]})),winner:0,landlord:0,bid:3,multiplier:1,log:[{text:'不应进入曲线',at:now+i}]}),now+i);
 // Modern Mahjong fixtures stay completely synthetic; only local DB is used.
 const mj=newModern(uid,'战报测试');mj.seats=[modernSeat(uid,'战报测试','1000'),...['甲','乙','丙'].map((name,i)=>modernSeat('mj-'+i,name,'1000'))];
 mj.phase='closed';mj.roundNumber=25;mj.stats={completed:24,draws:0,aborted:1};mj.ended=now+25;mj.seats.forEach((s,i)=>s.balance=String(1000+[720,-240,-240,-240][i]));
 insertRoom.run('123457','分页曲线麻将',JSON.stringify(mj),crypto.randomUUID(),now,now+25);
 for(let i=1;i<=25;i++){const delta=i===25?[0,0,0,0]:[30,-10,-10,-10];insertRound.run('report-mj-'+String(i).padStart(3,'0'),'123457',JSON.stringify({kind:'mahjong',schemaVersion:2,id:'mj'+i,roundNumber:i,rules:mj.rules,initialChips:'1000',baseChips:'10',winner:i===25?-1:0,source:i===25?-1:0,winType:i===25?'aborted':'self',wildcard:0,automatic:false,plan:null,awards:[],entries:[],started:now,ended:now+i,seats:mj.seats.map((s,n)=>({id:s.id,name:s.name,delta:String(delta[n]),balance:String(1000+Math.min(i,24)*[30,-10,-10,-10][n])}))}),now+i);}
 db.close();
 await request('/api/history?room='+roomCode,undefined,'',401);
 await request('/api/history?room='+roomCode,undefined,outsider.cookie,403);
 await request('/api/history?room=bad',undefined,player.cookie,400);
 const table=(await request('/api/history?room='+roomCode,undefined,player.cookie)).data;
 assert.equal(table.points.length,26);assert.deepEqual(table.points.at(-1).values,['150','-75','-75']);assert.equal(table.players.length,3);
 assert(!JSON.stringify(table).includes(uid));assert(!JSON.stringify(table).includes('不应进入曲线'));
 const list=(await request('/api/history?scope=tables&game=landlord',undefined,player.cookie)).data;
 assert.equal(list.items.find(r=>r.code===roomCode).delta,'150');assert.equal(list.items.find(r=>r.code===roomCode).rounds,25);
 const single=(await request('/api/history?id=report-000',undefined,player.cookie)).data;assert.equal(single.scores.points.length,2);
 const otherList=(await request('/api/history?scope=tables&game=landlord',undefined,outsider.cookie)).data;assert(!otherList.items.some(r=>r.code===roomCode));
 const v3=(await request('/api/history?room='+extended.code,undefined,v3Humans[0].cookie)).data;
 assert.equal(v3.unit,'胜利点');assert.equal(v3.points.length,2);assert.deepEqual(v3.points[1].values,extended.game.victoryPoints);
 const [first,second]=await Promise.all([0,1].map(page=>request('/api/mahjong/reports?room=123457&page='+page,undefined,player.cookie)));
 assert.equal(first.data.rounds.length,20);assert.equal(second.data.rounds.length,5);assert.deepEqual(first.data.scores,second.data.scores);assert.equal(first.data.scores.points.length,26);
 const shared=(await request('/api/mahjong/shares',{action:'create',code:'123457'},player.cookie)).data;
 const publicReport=(await request('/api/mahjong/public-report?id='+shared.id+'&page=1')).data;
 assert.deepEqual(publicReport.scores,first.data.scores);assert(!JSON.stringify(publicReport.scores).includes(uid));
 const singleShare=(await request('/api/mahjong/shares',{action:'create',code:'123457',round:'report-mj-001'},player.cookie)).data;
 assert.equal((await request('/api/mahjong/public-report?id='+singleShare.id)).data.scores.points.length,2);
 await request('/api/mahjong/shares',{action:'revoke',id:shared.id},player.cookie);
 await request('/api/mahjong/public-report?id='+shared.id,undefined,'',404);
}
