import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {generate,parseProgression,chordAt,PRESETS} from '../src/music.ts';import {generatePhraseV23} from '../src/generator-v23.ts';
import {auditMetrics} from '../research/audit_metrics.ts';
const model=JSON.parse(readFileSync('public/research/model.json','utf8'));
test('melodic regression: reduce beat-by-beat chord locking without replacing lines by scale runs',()=>{
 const old:number[]=[],fresh:number[]=[],runs:number[]=[],spans:number[]=[];
 for(const preset of PRESETS)for(let seed=301;seed<=308;seed++)for(const version of ['old','fresh']){
  const p=(version==='old'?generatePhraseV23:generate)(parseProgression(preset.text),140,60,84,seed,model);
  const m=auditMetrics(p.notes.filter(n=>n.pitch!==null).map(n=>({...n,pitch:n.pitch!,tones:chordAt(p.progression,n.start).tones,root:chordAt(p.progression,n.start).root})),p.progression.bars*4);
  (version==='old'?old:fresh).push(m.strongChord!);if(version==='fresh'){runs.push(m.stepRun!);spans.push(m.span);}
 }
 const mean=(a:number[])=>a.reduce((s,v)=>s+v,0)/a.length;
 assert(mean(fresh)<mean(old)-.05,'passing tones should remain available on interior beats');
 assert(mean(fresh)>.4&&mean(fresh)<.8,'avoid both ungrounded and chord-locked lines');
 assert(mean(runs)<.4,'do not replace chord arpeggios by endless scale runs');assert(mean(spans)>12);
});
test('audit does not count cropped window ends as phrase endings',()=>{
 const n=[{start:0,pitch:60,phrase:1,tones:[0,4,7],root:0},{start:.5,pitch:62,phrase:1,tones:[0,4,7],root:0}];
 assert.equal(auditMetrics(n,4).counts.phraseEnd,0);assert.equal(auditMetrics([...n,{...n[1],start:1,end:true}],4).counts.phraseEnd,1);
});
