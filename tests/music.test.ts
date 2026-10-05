import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {parseChord,parseProgression,generate,perform,pc,PRESETS,timingProfile,transposeChord,type Model} from '../src/music.ts';
import {segments} from '../src/score.ts';
const model:Model=JSON.parse(readFileSync(new URL('../public/research/model.json',import.meta.url),'utf8'));
test('chord parser: qualities, alterations, Unicode and inversions',()=>{
  const cases:Record<string,number[]>={C:[0,4,7],Cmaj:[0,4,7],Cm:[0,3,7],C7:[0,4,7,10],Cmaj7:[0,4,7,11],Cm7:[0,3,7,10],CmMaj7:[0,3,7,11],Cdim:[0,3,6],Cdim7:[0,3,6,9],Cm7b5:[0,3,6,10],C6:[0,4,7,9],'C6/9':[0,4,7,9,2],C9:[0,4,7,10,2],C13:[0,4,7,10,2,5,9],C7sus4:[0,5,7,10],Csus2:[0,2,7],Caug:[0,4,8],'C7(b9,#11)':[0,4,7,10,1,6],C7alt:[0,4,10,1,3,6,8]};
  for(const [s,expected] of Object.entries(cases))assert.deepEqual([...parseChord(s).tones].sort((a,b)=>a-b),[...expected].sort((a,b)=>a-b),s);
  assert.equal(parseChord('B♭7/D').bass,2);assert.equal(parseChord('F#ø7').root,6);assert.deepEqual(parseChord('CΔ7').tones,[0,4,7,11]);
  for(const s of ['H7','Cwat','C7(b9','C7)(','C7/H','Cmaj15','Calt'])assert.throws(()=>parseChord(s),s);
});
test('parser rejects malformed durations/bars, supports 1/2/4 chords',()=>{
  for(const s of ['C7','C | | C','C D E | C','C|C|C|C|C|C|C|C|C'])assert.throws(()=>parseProgression(s));
  const p=parseProgression('| C Dm7 Em7 F6 | G7 C6 |');assert.deepEqual(p.changes.map(x=>x.duration),[1,1,1,1,2,2]);assert.equal(p.bars,2);
});
test('12 keys x qualities x tempi: range, beat continuity, notation segments and replay',()=>{
  const names=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
  for(const root of names)for(const quality of ['maj7','m7','7b9','m7b5','dim7','7alt'])for(const bpm of [60,140,200,300]){
    const p=parseProgression(`${root}${quality} | ${root}6 |`),f=generate(p,bpm,48,72,42,model);
    assert.equal(JSON.stringify(f),JSON.stringify(generate(p,bpm,48,72,42,model)));
    let end=0;for(const n of f.notes){assert(Math.abs(n.start-end)<1e-6);assert(n.pitch===null||n.pitch>=48&&n.pitch<=72);end=n.start+n.duration;}assert(Math.abs(end-8)<1e-6);
    for(let bar=0;bar<2;bar++)assert(Math.abs(segments(f,bar).reduce((a,n)=>a+n.duration,0)-4)<1e-6);
    const original=JSON.stringify(f.notes),events=perform(f,bpm,model),slower=perform(f,Math.max(60,bpm-20),model);
    assert.equal(JSON.stringify(f.notes),original);assert.deepEqual(events.filter(e=>e.part==='solo').map(e=>e.pitch),slower.filter(e=>e.part==='solo').map(e=>e.pitch));
    assert(events.every(e=>Number.isFinite(e.time)&&e.time>=0&&e.time<8*60/bpm&&e.duration>0));
    const solo=events.filter(e=>e.part==='solo');for(let i=0;i<solo.length-1;i++)assert(solo[i].time+solo[i].duration<=solo[i+1].time+1e-6);
  }
});
test('all lengths 2–8, presets, narrow and extreme ranges',()=>{
  for(let bars=2;bars<=8;bars++)for(const [low,high] of [[36,48],[60,72],[84,96],[36,96]]){
    const p=parseProgression(Array(bars).fill('F#m7 B7').join('|'));const f=generate(p,140,low,high,987,model);assert(Math.abs(f.notes.at(-1)!.start+f.notes.at(-1)!.duration-bars*4)<1e-5);
  }
  for(const p of PRESETS)assert(parseProgression(p.text));
  assert.throws(()=>generate(parseProgression('C|C'),140,60,66,1,model));
});
test('timing confidence and no double swing transform',()=>{
  assert(timingProfile(80,model).estimated);assert(!timingProfile(160,model).estimated);
  for(const bpm of [60,80,140,200,280,300]){const p=timingProfile(bpm,model);assert(p.on>=0&&p.on<p.off&&p.off<1);}
  const f=generate(parseProgression('C7|F7'),140,60,84,5,model);f.notes=[{start:0,duration:.5,pitch:60,role:'line',phrase:1},{start:.5,duration:.5,pitch:62,role:'line',phrase:1},{start:1,duration:7,pitch:null,role:'rest',phrase:1}];
  const prof=timingProfile(140,model),ev=perform(f,140,model).filter(e=>e.part==='solo');assert(Math.abs(ev[0].time-prof.on*60/140)<1e-10);assert(Math.abs(ev[1].time-prof.off*60/140)<1e-10);
});
test('transposed chord roots and basses agree with sounding pitch classes',()=>{
  for(const root of ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'])for(const shift of [0,2,7,9]){
    const c=parseChord(root+'m7/G'),written=parseChord(transposeChord(c,shift));assert.equal(written.root,pc(c.root+shift));assert.equal(written.bass,pc(c.bass+shift));
  }
});
test('legacy saved triplet rounding artifacts are silent; real notes remain unchanged',()=>{
 const f=generate(parseProgression('C7|F7'),140,60,84,6,model);f.version='bebop-grammar-1.0';
 f.notes=[{start:0,duration:1,pitch:60,role:'line',phrase:1},{start:1,duration:2e-16,pitch:80,role:'line',phrase:1},{start:1,duration:1,pitch:62,role:'line',phrase:1},{start:2,duration:6,pitch:null,role:'rest',phrase:1}];
 assert.deepEqual(perform(f,140,model).filter(e=>e.part==='solo').map(e=>e.pitch),[60,62]);
});
