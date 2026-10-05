import {parseProgression,pc,rng,flatNames,generate,type Progression,type Model,type Phrase,chordAt} from './music.ts';
import {generatePhraseV24} from './generator-v24.ts';
export type HarmonyMode='standard'|'adventure';
// Changes are planned against the original progression; each destination is protected.
export function reharmonize(source:Progression,seed:number):Progression{
 const random=rng(seed^0x4a617a7a);
 const candidates:{index:number;bar:number;cell:number;symbol:string;split:boolean}[]=[];
 const bars=Array.from({length:source.bars},(_,bar)=>source.changes.filter(c=>c.bar===bar).map(c=>c.chord.symbol));
 for(let i=0;i<source.changes.length-1;i++){
  const a=source.changes[i],b=source.changes[i+1],c=a.chord,d=b.chord;
  if(c.bass!==c.root||d.bass!==d.root||!d.tones.includes(pc(d.root+(d.minor?3:4)))||!d.tones.includes(pc(d.root+7)))continue;
  const dominant=c.tones.includes(pc(c.root+4))&&c.tones.includes(pc(c.root+10));
  const cell=source.changes.filter(x=>x.bar===a.bar).indexOf(a);
  if(dominant&&pc(c.root-d.root)===7)candidates.push({index:i,bar:a.bar,cell,symbol:flatNames[pc(d.root+1)]+'7',split:false});
  else if(a.duration>=2&&!dominant)candidates.push({index:i,bar:a.bar,cell,symbol:flatNames[pc(d.root+7)]+(d.minor?'7b9':'7'),split:true});
 }
 // Shuffle without sorting with a random comparator; same seed gives the same plan.
 for(let i=candidates.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
 const limit=1+Math.floor(random()*Math.min(3,Math.ceil(source.bars/2))),used=new Set<number>(),usedBars=new Set<number>();let count=0;
 for(const c of candidates){
  if(count>=limit)break;
  if(used.has(c.index)||used.has(c.index+1)||usedBars.has(c.bar))continue;
  if(c.split)bars[c.bar]=bars[c.bar].flatMap((symbol,j)=>j===c.cell?[symbol,c.symbol]:[symbol,symbol]);
  else bars[c.bar][c.cell]=c.symbol;
  used.add(c.index);used.add(c.index+1);usedBars.add(c.bar);count++;
 }
 return count?parseProgression(bars.map(row=>row.join(' ')).join(' | ')):source;
}
// Pitch-only vocabulary: keep every onset, duration, rest and triplet exactly as generated.
export function elaborateMelody(phrase:Phrase,seed:number):Phrase{
 const notes=phrase.notes.map(n=>({...n})),random=rng(seed^0x426f705f),protectedNotes=new Set<number>();
 notes.forEach((n,i)=>{if(['approach','enclosure','resolution','landing'].includes(n.role)){protectedNotes.add(i);if(n.role==='approach'||n.role==='enclosure')protectedNotes.add(i+1);}});
 let lastTarget=-6;
 for(let i=2;i<notes.length;i++){
  const target=notes[i],a=notes[i-2],b=notes[i-1];
  if(i-lastTarget<5||target.pitch===null||a.pitch===null||b.pitch===null||a.phrase!==target.phrase||b.phrase!==target.phrase||[a,b,target].some(n=>n.triplet)||a.duration!==.5||b.duration!==.5||target.start%1!==0)continue;
  if(protectedNotes.has(i-2)||protectedNotes.has(i-1)||!chordAt(phrase.progression,target.start).tones.includes(pc(target.pitch))||random()>.7)continue;
  const pitch=target.pitch,c=chordAt(phrase.progression,target.start);
  const upper=[pitch+1,pitch+2].find(p=>c.scale.includes(pc(p)))??pitch+2;
  const lower=[pitch-1,pitch-2].find(p=>c.scale.includes(pc(p)))??pitch-2;
  const prior=notes[i-3]?.pitch;
  const variants=[{p:[upper,pitch-1],kind:'enclosure'},{p:[lower,pitch+1],kind:'enclosure'},{p:[pitch-2,pitch-1],kind:'chromatic-line'},{p:[pitch+2,pitch+1],kind:'chromatic-line'}].filter(v=>v.p.every(p=>p>=phrase.low&&p<=phrase.high)&&(prior===null||prior===undefined||Math.abs(v.p[0]-prior)<=5));
  if(!variants.length)continue;
  const variant=variants[Math.floor(random()*variants.length)];
  a.pitch=variant.p[0];a.role=variant.kind;b.pitch=variant.p[1];b.role='approach';
  if(target.role!=='landing')target.role='resolution';lastTarget=i;
  protectedNotes.add(i-2);protectedNotes.add(i-1);protectedNotes.add(i);
 }
 return {...phrase,notes};
}
export function generatePractice(progression:Progression,bpm:number,low:number,high:number,seed:number,model:Model,mode:HarmonyMode='standard'):Phrase{
 if(mode==='standard')return generate(progression,bpm,low,high,seed,model);
 const changed=reharmonize(progression,seed);
 const phrase=changed===progression?generate(progression,bpm,low,high,seed,model):generatePhraseV24(changed,bpm,low,high,seed,model,true);
 return {...elaborateMelody(phrase,seed),originalProgression:progression,version:phrase.version+' / adventure-2.0'};
}
export function harmonyChanges(p:Phrase){
 if(!p.originalProgression)return [];
 return p.progression.changes.flatMap(c=>{const old=p.originalProgression!.changes.find(x=>c.start>=x.start&&c.start<x.start+x.duration)!;return old.chord.symbol===c.chord.symbol?[]:[{bar:c.bar,beat:c.start-c.bar*4+1,from:old.chord.symbol,to:c.chord.symbol}];});
}
