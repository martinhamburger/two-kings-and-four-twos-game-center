import test from 'node:test';
import assert from 'node:assert/strict';
import {feedbackDay,feedbackText,feedbackLength} from '../../lib/club/feedback.ts';
test('daily feedback quota resets at midnight in Beijing, including year rollover',()=>{
 assert.equal(feedbackDay(Date.parse('2026-12-31T15:59:59.999Z')),'2026-12-31');
 assert.equal(feedbackDay(Date.parse('2026-12-31T16:00:00.000Z')),'2027-01-01');
});
test('feedback counts Unicode characters, rejects empty/control/overlong text and keeps plain text',()=>{
 assert.equal(feedbackText('  建议\n保留换行  '),'建议\n保留换行');
 assert.equal(feedbackLength('😀'.repeat(200)),200);
 assert.equal(feedbackText('😀'.repeat(200)),'😀'.repeat(200));
 for(const bad of ['', ' \n\t ',null,200,'字'.repeat(201),'😀'.repeat(201),'建议\0后续'])assert.throws(()=>feedbackText(bad));
 assert.equal(feedbackText('<script>alert(1)</script>'),'<script>alert(1)</script>');
});
