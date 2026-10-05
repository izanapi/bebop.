import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {parseProgression,generate,chordAt,perform,PRESETS} from '../src/music.ts';import {reharmonize,generatePractice,harmonyChanges,elaborateMelody} from '../src/reharmony.ts';import {transposeProgression,transposePhrase,validateSaved} from '../src/practice.ts';import {createSession} from '../src/session.ts';
const model=JSON.parse(readFileSync('public/research/model.json','utf8'));
test('standard mode preserves exact existing output; adventure preserves destinations and input',()=>{
 for(let key=0;key<12;key++)for(const text of ['G7 | Cmaj7 |','Cmaj7 | Dm7 |','Cmaj7 Dm7 | G7 Cmaj7 |']){
 const p=transposeProgression(parseProgression(text),key,key),before=JSON.stringify(p);
 assert.deepEqual(generatePractice(p,140,60,84,7,model),generate(p,140,60,84,7,model));
 const changed=reharmonize(p,7);assert.equal(JSON.stringify(p),before);assert.equal(changed.bars,p.bars);assert.equal(changed.changes.at(-1)!.chord.symbol,p.changes.at(-1)!.chord.symbol);
 assert.deepEqual(changed,reharmonize(p,7));assert.deepEqual(parseProgression(changed.text),changed);
 const f=generatePractice(p,140,60,84,7,model,'adventure');assert.equal(harmonyChanges(f).length,1);
 const music=perform(f,140,model);assert.equal(music.filter(e=>e.part==='solo').length,f.notes.filter(n=>n.pitch!==null).length);
 }
 assert.equal(reharmonize(parseProgression('G7 | Cmaj7 |'),1).text,'Db7 | Cmaj7');
 assert.equal(reharmonize(parseProgression('Cmaj7 | Dm7 |'),1).text,'Cmaj7 A7b9 | Dm7');
});
test('adventure favorite and key transposition preserve both harmonies; trading answer uses the same substitution',()=>{
 const p=parseProgression('Dm7 | G7 | Cmaj7 | C6 |');
 const f=generatePractice(p,140,60,84,17,model,'adventure');
 const saved=validateSaved({id:'test',name:'test',createdAt:1,key:0,bpm:140,phrase:f});assert.deepEqual(saved.phrase,f);
 const moved=transposePhrase(f,0,2);assert.equal(moved.originalProgression!.changes[0].chord.root,4);assert.equal(harmonyChanges(moved).length,harmonyChanges(f).length);
 const next=createSession({mode:'trade',harmony:'adventure',bars:4,key:0,minor:false,seed:8,bpm:140,low:60,high:84,progression:p},model);
 for(let i=0;i<8;i++){const demo=next(i*2),answer=next(i*2+1);assert(!answer.solo);assert.deepEqual(demo.phrase,answer.phrase);assert(harmonyChanges(demo.phrase).length>=1);}
 const plain=parseProgression('Cdim7 | Cdim7 |');assert.equal(reharmonize(plain,1),plain);
});
test('altered and narrow-range adventure phrases keep resolved approaches and valid durations',()=>{
 for(const preset of PRESETS)for(const bpm of [80,280])for(const [low,high] of [[60,72],[48,84]])for(let seed=1;seed<=8;seed++){
 const f=generatePractice(parseProgression(preset.text),bpm,low,high,seed,model,'adventure');
 assert(f.notes.every(n=>n.pitch===null||n.pitch>=low&&n.pitch<=high));assert(Math.abs(f.notes.reduce((s,n)=>s+n.duration,0)-f.progression.bars*4)<1e-6);
 for(let i=0;i<f.notes.length;i++)if(f.notes[i].role==='approach')assert.equal(Math.abs(f.notes[i].pitch!-f.notes[i+1].pitch!),1);
 }
});

test('adventure varies harmonic density and changes pitches without changing rhythm',()=>{
 const p=parseProgression('Dm7 | G7 | Cmaj7 | C6 | Dm7 | G7 | Cmaj7 | C6 |'),counts=new Set<number>();let altered=0;
 for(let seed=1;seed<=60;seed++){
  const f=generatePractice(p,140,60,84,seed,model,'adventure');counts.add(harmonyChanges(f).length);
  const base=generate(p,140,60,84,seed,model),decorated=elaborateMelody(base,seed);
  assert.deepEqual(decorated.notes.map(({pitch,role,...n})=>n),base.notes.map(({pitch,role,...n})=>n));
  if(decorated.notes.some((n,i)=>n.pitch!==base.notes[i].pitch))altered++;
  for(let i=0;i<decorated.notes.length;i++)if(decorated.notes[i].role==='approach')assert.equal(Math.abs(decorated.notes[i].pitch!-decorated.notes[i+1].pitch!),1);
 }
 assert(counts.has(1));assert([...counts].some(n=>n>=2));assert([...counts].every(n=>n<=3));assert(altered>20);
});
