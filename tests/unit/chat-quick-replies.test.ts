import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CHAT_QUICK_REPLIES} from '../../lib/chat-quick-replies.ts';

test('quick chat exposes ten unique server-valid text messages',()=>{
 assert.equal(CHAT_QUICK_REPLIES.length,10);
 assert.equal(new Set(CHAT_QUICK_REPLIES).size,CHAT_QUICK_REPLIES.length);
 for(const reply of CHAT_QUICK_REPLIES){
  assert.equal(reply,reply.trim());
  assert(reply.length>0&&reply.length<=500);
  assert(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(reply));
 }
});

test('quick chat keeps the requested phrases and the neutral tenth option',()=>{
 assert.deepEqual([...CHAT_QUICK_REPLIES],[
  '祝你好运！','加油！','精彩的比赛！','承让！','哇哦！',
  '牛逼','666','哈哈','菜比','打得真烂！',
 ]);
});
