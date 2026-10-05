import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {createSession,PROGRESSION_LIBRARY,type SessionOptions} from '../src/session.ts';import {parseProgression,pc} from '../src/music.ts';
const model=JSON.parse(readFileSync('public/research/model.json','utf8'));
const options:SessionOptions={mode:'trade',bars:2,key:0,minor:false,seed:92,bpm:140,low:60,high:84,progression:parseProgression('Dm7 | G7 | Cmaj7 | A7 |')};
test('trading gives exactly the same chords and phrase on the silent answer, then advances and wraps',()=>{
 const next=createSession(options,model);const first=next(0),answer=next(1),second=next(2);assert(first.solo);assert(!answer.solo);assert.deepEqual(answer.phrase,first.phrase);assert.equal(first.phrase.progression.text,'Dm7 | G7');assert.equal(second.phrase.progression.text,'Cmaj7 | A7');next(3);const wrapped=next(4);assert.equal(wrapped.phrase.progression.text,first.phrase.progression.text);assert.notEqual(wrapped.phrase.seed,first.phrase.seed);
 const odd=createSession({...options,bars:4,progression:parseProgression('C6 | Dm7 | G7 |')},model);assert.equal(odd(0).phrase.progression.text,'C6 | Dm7 | G7 | C6');
});
test('endless mode produces reproducible changing phrases and tonal progressions in all 12 keys',()=>{
 for(let key=0;key<12;key++)for(const minor of [false,true])for(const bars of [2,4] as const){
  const opts={...options,mode:'endless' as const,key,minor,bars},a=createSession(opts,model),b=createSession(opts,model);const seeds=new Set(),progressions=new Set(),roots=new Set();
  for(let cycle=0;cycle<16;cycle++){const x=a(cycle);assert.deepEqual(x,b(cycle));assert.equal(x.phrase.progression.bars,bars);assert(x.solo);const first=x.phrase.progression.changes[0].chord;roots.add(pc(first.root-key));
  const allowed=PROGRESSION_LIBRARY[minor?'minor':'major'][bars].map(t=>parseProgression(t));
  assert(allowed.some(p=>p.changes.length===x.phrase.progression.changes.length&&p.changes.every((c,i)=>pc(c.chord.root+key)===x.phrase.progression.changes[i].chord.root)));
  seeds.add(x.phrase.seed);progressions.add(x.phrase.progression.text);}
  assert.equal(seeds.size,16);assert.equal(progressions.size,8);assert(roots.size>=5);
 }
});

test('random trading presents a new progression per question, identical answer harmony, and no repeats within a deck',()=>{
 for(const bars of [2,4] as const)for(const minor of [false,true]){
  const next=createSession({...options,mode:'trade-random',bars,minor,harmony:'adventure'},model),seen=new Set<string>();let previous='';
  for(let round=0;round<24;round++){
   const demo=next(round*2),answer=next(round*2+1);assert(demo.solo);assert(!answer.solo);assert.deepEqual(demo.phrase,answer.phrase);
   const original=demo.phrase.originalProgression!.text;assert.notEqual(original,previous);previous=original;
   if(round%8===0)seen.clear();assert(!seen.has(original));seen.add(original);
  }
 }
});
