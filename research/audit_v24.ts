import {readFileSync,writeFileSync} from 'node:fs';
import {parseProgression,chordAt,PRESETS} from '../src/music.ts';
import {generatePhraseV23} from '../src/generator-v23.ts';
import {generatePhraseV24} from '../src/generator-v24.ts';
import {auditMetrics,summarize} from './audit_metrics.ts';
const model=JSON.parse(readFileSync('public/research/model.json','utf8')),corpus=JSON.parse(readFileSync('../../work/research/audit-reference-v24.json','utf8'));
const refs:any[]=[],generated:any[]=[];
for(const s of corpus.filter((s:any)=>s.split==='train'))for(const bars of [4,8]){
 const first=Math.ceil(s.notes[0].start/4)*4,last=Math.floor(s.notes.at(-1).start/4)*4;
 for(let start=first;start+bars*4<=last;start+=bars*4){const ns=s.notes.filter((n:any)=>n.start>=start&&n.start<start+bars*4);if(ns.length<6)continue;refs.push({id:s.id,performer:s.performer,bpm:s.bpm,bars,...auditMetrics(ns,bars*4)});}
}
for(let preset=0;preset<PRESETS.length;preset++)for(const bpm of [80,140,200,280])for(let seed=1001;seed<=1030;seed++){
 const p=(process.argv.includes('--candidate')?generatePhraseV24:generatePhraseV23)(parseProgression(PRESETS[preset].text),bpm,60,84,seed,model);const ns=p.notes.filter(n=>n.pitch!==null).map(n=>({...n,pitch:n.pitch!,tones:chordAt(p.progression,n.start).tones,root:chordAt(p.progression,n.start).root}));
 generated.push({preset,bpm,seed,bars:p.progression.bars,...auditMetrics(ns,p.progression.bars*4)});
}
const result={reference:summarize(refs),generatedSummary:summarize(generated),referenceWindows:refs.length,generatedCount:generated.length,refs,generated};writeFileSync(process.argv.includes('--candidate')?'../../work/research/strict-audit-candidate.json':'../../work/research/strict-audit-baseline.json',JSON.stringify(result));console.log(JSON.stringify({...result,refs:undefined,generated:undefined},null,2));
