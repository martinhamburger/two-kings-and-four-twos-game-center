import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LAST_PIXEL_URL,MINESWEEPER_URL} from '../../lib/indie-games.ts';

test('indie launchers use distinct secure GitHub Pages destinations',()=>{
 const urls=[LAST_PIXEL_URL,MINESWEEPER_URL];
 assert.equal(new Set(urls).size,urls.length);
 for(const value of urls){
  const url=new URL(value);
  assert.equal(url.protocol,'https:');
  assert.equal(url.hostname,'cyh29hao.github.io');
  assert.equal(url.pathname.endsWith('/'),true);
 }
});
