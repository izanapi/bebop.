import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {parseProgression,generate,perform,PRESETS,type Model,type TimingMode} from '../src/music.ts';
import {renderPCM,SAMPLE_RATE} from '../src/sound.ts';
const model:Model=JSON.parse(readFileSync(new URL('../public/research/model.json',import.meta.url),'utf8'));
const analysis=JSON.parse(readFileSync(new URL('../public/research/analysis.json',import.meta.url),'utf8'));
const out=new URL('../public/research/',import.meta.url);mkdirSync(out,{recursive:true});
const median=(a:number[])=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
const rows:any[]=[];
for(const preset of PRESETS)for(const bpm of [80,140,200,280])for(let seed=1;seed<=30;seed++){
  const p=generate(parseProgression(preset.text),bpm,60,84,seed,model);
  const sounding=p.notes.filter(n=>n.pitch!==null);const intervals=sounding.slice(1).map((n,i)=>Math.abs(n.pitch!-sounding[i].pitch!));
  assert(Math.abs(p.notes.reduce((a,n)=>a+n.duration,0)-p.progression.bars*4)<1e-5);
  assert(p.notes.every(n=>n.duration>0&& (n.pitch===null||n.pitch>=60&&n.pitch<=84)));
  assert(perform(p,bpm,model).every(e=>Number.isFinite(e.time)&&e.duration>0&&e.time>=0));
  const approaches=p.notes.flatMap((n,i)=>n.role==='approach'?[Math.abs(n.pitch!-p.notes[i+1].pitch!)]:[]);
  assert(approaches.every(x=>x===1),'chromatic approach resolves by semitone');
  rows.push({preset:preset.name,bpm,seed,density:sounding.length/(p.progression.bars*4),stepFraction:intervals.filter(x=>x<=2).length/intervals.length,largeLeapFraction:intervals.filter(x=>x>7).length/intervals.length,
    restFraction:p.notes.filter(n=>n.pitch===null).reduce((a,n)=>a+n.duration,0)/(p.progression.bars*4),phrases:Math.max(...p.notes.map(n=>n.phrase))});
}
const ref=analysis.test.intervalCounts;let all=0,steps=0,leaps=0;for(const [i,v] of Object.entries(ref)){all+=v as number;if(Math.abs(+i)<=2)steps+=v as number;if(Math.abs(+i)>7)leaps+=v as number;}
const result={date:'2026-10-05',generated:rows.length,holdoutSolos:analysis.test.solos,splitLeakage:analysis.solos.filter((s:any)=>s.style==='BEBOP'&&s.split==='train').some((s:any)=>analysis.solos.some((t:any)=>t.style==='BEBOP'&&t.split==='test'&&t.trackid===s.trackid)),
  generatedSummary:{densityMedian:median(rows.map(r=>r.density)),stepFractionMedian:median(rows.map(r=>r.stepFraction)),largeLeapFractionMedian:median(rows.map(r=>r.largeLeapFraction)),restFractionMedian:median(rows.map(r=>r.restFraction))},
  holdoutSummary:{densityMedian:analysis.test.density.median,stepFraction:steps/all,largeLeapFraction:leaps/all,phraseBarsMedian:analysis.test.phraseBars.median},
  limitations:['Distribution similarity does not establish musical quality.','Human expert listening and physical iPhone validation have not been performed.','Rest fraction cannot be directly equated to acoustic gaps in the corpus.'],rows};
assert(!result.splitLeakage);
writeFileSync(new URL('evaluation.json',out),JSON.stringify(result,null,2));
function wav(a:Float32Array){const b=Buffer.alloc(44+a.length*2);b.write('RIFF');b.writeUInt32LE(36+a.length*2,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(SAMPLE_RATE,24);b.writeUInt32LE(SAMPLE_RATE*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(a.length*2,40);a.forEach((v,i)=>b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),44+i*2));return b;}
const phrase=generate(parseProgression(PRESETS[0].text),140,60,84,20261005,model);
let maxPeak=0;const renders=[];
for(const bpm of [80,140,200,280])for(const mode of ['model','straight','triplet'] as TimingMode[]){
  const events=perform(phrase,bpm,model,mode);const pcm=renderPCM(events,phrase.progression.bars*4*60/bpm+.4);
  let peak=0,energy=0;for(const v of pcm){peak=Math.max(peak,Math.abs(v));energy+=v*v;}
  maxPeak=Math.max(maxPeak,peak);assert(peak<.98);assert(energy/pcm.length>.000001);
  const file=`example-${bpm}-${mode}.wav`;writeFileSync(new URL(file,out),wav(pcm));renders.push({bpm,mode,file,peak,rms:Math.sqrt(energy/pcm.length)});
}
writeFileSync(new URL('audition.json',out),JSON.stringify({phrase,renders,subjectiveAssessment:'Not evaluated by a human jazz musician; these are reproducible listening comparisons, not evidence of perceptual improvement.'},null,2));
console.log(JSON.stringify({...result,rows:undefined,maxPeak},null,2));
