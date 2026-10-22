import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

// Execute the production JSX branches with inert leaf components. This tests
// their actual conditions without a browser, Next router or a copied predicate.
function source(path:string){return ts.createSourceFile(path,readFileSync(new URL('../../'+path,import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);}
function find(root:ts.Node,predicate:(node:ts.Node)=>boolean):ts.Node{
 let result:ts.Node|undefined;
 function visit(node:ts.Node){if(!result&&predicate(node))result=node;if(!result)ts.forEachChild(node,visit);}
 visit(root);assert(result,'Production JSX branch must exist');return result;
}
function evaluate(text:string,values:Record<string,unknown>){
 const js=ts.transpileModule(`const result=(${text});`,{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText;
 return new Function(...Object.keys(values),js+'return result;')(...Object.values(values));
}
const CardGroupPreview=({name,cards}:{name:string;cards:number[]})=>React.createElement('div',{'aria-label':name},cards.join(','));
const Button=({children}:{children:React.ReactNode})=>React.createElement('button',null,children);

test('actual self-hand JSX retains nonempty final hands after a friendly match closes',()=>{
 const file=source('app/page.tsx');
 const preview=find(file,n=>ts.isJsxSelfClosingElement(n)&&n.tagName.getText(file)==='CardGroupPreview'&&n.attributes.getText(file).includes('本人剩余牌'));
 assert(ts.isBinaryExpression(preview.parent));
 const branch=preview.parent.getText(file);
 for(const v3 of [false,true])for(const [phase,status,visible] of [
  ['finished',undefined,true],['closed','finished',true],['closed','interrupted',false],
  ['closed',undefined,false],['playing','playing',false],['waiting',undefined,false],
 ] as const){
  const html=renderToStaticMarkup(evaluate(branch,{React,CardGroupPreview,g:{phase,friendlyMatch:status?{status}:undefined},me:{hand:[10,11]},v3}));
  assert.equal(html.includes('本人剩余牌'),visible,`${phase}/${status}/${v3}`);
  if(visible)assert(html.includes('10,11'));
 }
});

test('actual history JSX offers table navigation only with explicit current-seat permission',()=>{
 const file=source('app/history/page.tsx');
 const button=find(file,n=>ts.isJsxElement(n)&&n.openingElement.tagName.getText(file)==='Button'&&n.getText(file).includes('查看牌桌'));
 assert(ts.isBinaryExpression(button.parent));
 for(const canInspectTable of [true,false,undefined]){
  const html=renderToStaticMarkup(evaluate(button.parent.getText(file),{React,Button,detail:{tableReport:{canInspectTable}},opening:false,inspectLastTable:()=>{}}));
  assert.equal(html.includes('查看牌桌'),canInspectTable===true);
 }
});

test('history handler independently refuses records-only navigation and uses read-only room opening',async()=>{
 const file=source('app/history/page.tsx');
 const handler=find(file,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='inspectLastTable');
 for(const allowed of [false,undefined,true]){
  const calls:unknown[][]=[];
  const fn=evaluate(handler.getText(file),{detail:{tableReport:{code:'123456',game:'landlord',canInspectTable:allowed}},setOpening:()=>{},setDetail:()=>{},setError:()=>{},openRoom:async(...args:unknown[])=>{calls.push(args);}});
  await fn();assert.deepEqual(calls,allowed?[['landlord','123456']]:[]);
 }
});

test('shared opponent JSX retains endgame public-hand override and completed friendly hands without opening live opponents',()=>{
 const file=source('components/landlord-opponent.tsx');
 const preview=find(file,n=>ts.isJsxSelfClosingElement(n)&&n.tagName.getText(file)==='CardGroupPreview'&&n.attributes.getText(file).includes('showLabel'));
 assert(ts.isBinaryExpression(preview.parent));
 for(const [phase,status] of [['playing',undefined],['finished',undefined],['closed','finished'],['closed','interrupted']] as const)for(const publicHand of [null,React.createElement('div',null,'残局明牌')]){
  const html=renderToStaticMarkup(evaluate(preview.parent.getText(file),{React,CardGroupPreview,s:{name:'对手',hand:[10]},g:{phase,friendlyMatch:status?{status}:undefined},publicHand,v3:false}));
  assert.equal(html.includes('对手剩余牌'),!publicHand&&(phase==='finished'||phase==='closed'&&status==='finished'));
 }
 // Both live room and local editor must continue using the same component.
 const live=source('app/page.tsx').getText();
 assert(live.includes("import {LandlordOpponent as OpponentSeat} from '@/components/landlord-opponent'"));
 assert(!live.includes('const OpponentSeat=memo('));
});
