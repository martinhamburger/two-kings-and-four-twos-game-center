import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';

// Execute the route's real conditional writes against controlled interleavings.
// This avoids a timing-dependent HTTP race and catches weakened SQL guards.
const route=readFileSync(new URL('../../app/api/tv/route.ts',import.meta.url),'utf8');
const withdrawSql=route.match(/prepare\('([^']*DELETE FROM replay_tv[^']*)'\)/)?.[1];
const removeSql=route.match(/prepare\('([^']*UPDATE replay_tv[^']*)'\)/)?.[1];
const auditSql=route.match(/prepare\('([^']*INSERT INTO audit[^']*)'\)/)?.[1];

function setup(){
 const database=new DatabaseSync(':memory:');
 database.exec('CREATE TABLE replay_tv (replay_id TEXT PRIMARY KEY, submitted_by TEXT, submitted_at INTEGER, withdrawn_at INTEGER); CREATE TABLE audit (id TEXT PRIMARY KEY, actor TEXT, action TEXT, created INTEGER); INSERT INTO replay_tv VALUES (\'round\',\'poster\',1000,NULL)');
 return database;
}

test('a delayed withdrawal cannot erase an administrator removal tombstone',()=>{
 assert.ok(withdrawSql);
 const database=setup();
 try{
  database.prepare('UPDATE replay_tv SET withdrawn_at=2000 WHERE replay_id=?').run('round');
  const bindings=withdrawSql.includes('submitted_at=?')?['round','poster',1000]:['round','poster'];
  assert.equal(database.prepare(withdrawSql).run(...bindings).changes,0);
  assert.equal(database.prepare('SELECT withdrawn_at FROM replay_tv').get()?.withdrawn_at,2000);
  assert.throws(()=>database.prepare('INSERT INTO replay_tv VALUES (?,?,?,NULL)').run('round','poster',3000));
 }finally{database.close();}
});

test('a delayed moderation operation cannot remove a replacement submission',()=>{
 assert.ok(removeSql);assert.ok(auditSql);
 const database=setup();
 try{
  database.prepare('DELETE FROM replay_tv WHERE replay_id=?').run('round');
  database.prepare('INSERT INTO replay_tv VALUES (?,?,?,NULL)').run('round','poster',3000);
  const bindings=removeSql.includes('submitted_at=?')?[4000,'round','poster',1000]:[4000,'round'];
  assert.equal(database.prepare(removeSql).run(...bindings).changes,0);
  assert.equal(database.prepare(auditSql).run('audit-1','admin','remove',4000).changes,0);
  assert.equal(database.prepare('SELECT withdrawn_at FROM replay_tv').get()?.withdrawn_at,null);
 }finally{database.close();}
});

test('a current publication can be withdrawn, or removed with exactly one audit record',()=>{
 assert.ok(withdrawSql);assert.ok(removeSql);assert.ok(auditSql);
 const database=setup();
 try{
  assert.equal(database.prepare(withdrawSql).run('round','poster',1000).changes,1);
  database.prepare('INSERT INTO replay_tv VALUES (?,?,?,NULL)').run('round','poster',3000);
  database.exec('BEGIN');
  assert.equal(database.prepare(removeSql).run(4000,'round','poster',3000).changes,1);
  assert.equal(database.prepare(auditSql).run('audit-1','admin','remove',4000).changes,1);
  database.exec('COMMIT');
  assert.equal(database.prepare(removeSql).run(5000,'round','poster',3000).changes,0);
  assert.equal(database.prepare(auditSql).run('audit-2','admin','remove',5000).changes,0);
  assert.equal(database.prepare('SELECT COUNT(*) AS n FROM audit').get()?.n,1);
  assert.equal(database.prepare(withdrawSql).run('round','poster',3000).changes,0);
 }finally{database.close();}
});
