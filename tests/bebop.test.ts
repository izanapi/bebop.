import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {generate,parseProgression,transposeChord,chordAt,pc,perform,type Model} from '../src/music.ts';import {findBebopCadences} from '../src/generator-v21.ts';import {segments} from '../src/score.ts';
const model:Model=JSON.parse(readFileSync('public/research/model.json','utf8'));
test('functional cadence analysis follows major/minor ii–V–I in all 12 keys, not blues or suspended dominants',()=>{
 for(let key=0;key<12;key++)for(const text of ['Dm7 G7alt | Cmaj7 |','Dm7b5 G7b9 | Cm6 |']){
  const original=parseProgression(text),input=original.changes.map((c,i)=>transposeChord(c.chord,key)+(i===0?' ':' | ')).join('');
  const p=parseProgression(input),cs=findBebopCadences(p);assert.equal(cs.length,1);assert(cs[0].hasTwo);assert.equal(cs[0].resolve,4);assert.equal(cs[0].minor,text.includes('Cm6'));
 }
 for(const text of ['C7 | F7 |','G7sus4 | Cmaj7 |','Gm7 | Cmaj7 |'])assert.equal(findBebopCadences(parseProgression(text)).length,0);
});
test('cadences articulate guides; bebop enclosures resolve; notation and playback retain every real note',()=>{
 let enclosures=0,resolutions=0,answers=0;
 for(const text of ['Dm7 G7alt | Cmaj7 | Am7 D7 | Gmaj7 |','Dm7b5 G7b9 | Cm6 | Fm7 Bb7 | Ebmaj7 |'])for(const bpm of [80,140,200,280])for(let seed=1;seed<=30;seed++){
  const p=generate(parseProgression(text),bpm,60,84,seed,model);assert(p.version.startsWith('bebop-grammar-2.4'));
  const events=perform(p,bpm,model).filter(e=>e.part==='solo');assert.equal(events.length,p.notes.filter(n=>n.pitch!==null).length);
  for(let i=0;i<p.notes.length;i++){
   const n=p.notes[i];assert(n.duration>=1/3-1e-6);
   if(n.role==='resolution'){resolutions++;assert(chordAt(p.progression,n.start).tones.includes(pc(n.pitch!)));}
   if(n.role==='enclosure'&&p.notes[i+1]?.role==='resolution'){enclosures++;assert.equal(Math.abs(n.pitch!-p.notes[i+1].pitch!),1);assert(p.notes[i-1].pitch!>p.notes[i+1].pitch!);}
   if(n.role==='answer')answers++;
  }
  for(let bar=0;bar<p.progression.bars;bar++)assert(Math.abs(segments(p,bar).reduce((s,n)=>s+n.duration,0)-4)<1e-6);
  for(let i=1;i<events.length;i++)assert(events[i-1].time+events[i-1].duration<=events[i].time+1e-6);
 }
 assert(enclosures>0);assert(resolutions>0);assert(answers>0);
});
test('register exploration respects narrow, low and wide ranges and retains resolved enclosures',()=>{
 const spans:number[]=[];let wideLeaps=0;
 for(const [low,high] of [[36,48],[48,72],[60,84],[48,84],[84,96],[36,96]])for(let seed=1;seed<=40;seed++){
  const p=generate(parseProgression('Dm7 G7alt | Cmaj7 | Dm7b5 G7b9 | Cm6 |'),140,low,high,seed,model);
  const ns=p.notes.filter(n=>n.pitch!==null);assert(ns.every(n=>n.pitch!>=low&&n.pitch!<=high));
  if(low===60&&high===84){spans.push(Math.max(...ns.map(n=>n.pitch!))-Math.min(...ns.map(n=>n.pitch!)));wideLeaps+=ns.slice(1).filter((n,i)=>Math.abs(n.pitch!-ns[i].pitch!)>7).length;}
  const events=perform(p,140,model).filter(e=>e.part==='solo');for(let i=1;i<events.length;i++)assert(events[i-1].time+events[i-1].duration<=events[i].time+1e-6);
 }
 assert(wideLeaps>0,'larger chord-tone jumps should be reachable');assert(spans.some(s=>s>12),'two-octave allowance must not act as a one-octave limit');
});
