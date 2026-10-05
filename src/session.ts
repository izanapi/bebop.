import {generatePractice,type HarmonyMode} from './reharmony.ts';
import {generate,parseProgression,rng,type Model,type Phrase,type Progression} from './music.ts';
import {transposeProgression} from './practice.ts';
export type SessionBlock={phrase:Phrase;solo:boolean;label:string};
export type SessionOptions={mode:'trade'|'trade-random'|'endless';harmony?:HarmonyMode;bars:2|4;key:number;minor:boolean;seed:number;bpm:number;low:number;high:number;progression:Progression};
// Practice arrangements of tonic, turnaround, secondary dominant and ii–V–I units;
// not transcriptions or an empirical distribution of jazz standards.
// Separate short forms preserve a harmonic destination instead of truncating four-bar forms.
export const PROGRESSION_LIBRARY={
 major:{
  2:['Dm7 G7 | C6','Em7 A7 | Dm7 G7','Am7 D7 | Dm7 G7','Fmaj7 Fm6 | C6','D7 | Dm7 G7','Bm7b5 E7b9 | Am7 D7','Gm7 C7 | Fmaj7','C6 A7 | Dm7 G7'],
  4:['Dm7 | G7 | Cmaj7 | C6','Em7 A7 | Dm7 G7 | C6 A7 | Dm7 G7','Am7 | D7 | Dm7 | G7','Fmaj7 | Fm6 | C6 A7 | Dm7 G7','D7 | D7 | Dm7 | G7','Bm7b5 | E7b9 | Am7 | D7 G7','Gm7 | C7 | Fmaj7 Fm6 | C6','C6 A7 | Dm7 G7 | Em7 A7 | Dm7 G7']
 },
 minor:{
  2:['Dm7b5 G7b9 | Cm6','Fm7 Bb7 | Ebmaj7 G7b9','Abmaj7 | Dm7b5 G7alt','G7b9 | Cm6','Cm6 A7alt | Dm7b5 G7b9','Em7b5 A7b9 | Dm7b5 G7b9','Bb7 | Ebmaj7 G7b9','Fm6 | Cm6 G7alt'],
  4:['Dm7b5 | G7b9 | Cm6 | Cm6','Fm7 | Bb7 | Ebmaj7 | Dm7b5 G7b9','Abmaj7 | Fm7 | Dm7b5 | G7alt','G7b9 | Cm6 | Fm7 | G7b9','Cm6 A7alt | Dm7b5 G7b9 | Cm6 | Dm7b5 G7alt','Em7b5 | A7b9 | Dm7b5 | G7b9','Bb7 | Ebmaj7 | Abmaj7 | Dm7b5 G7alt','Fm6 | Cm6 | Ab7 | G7b9']
 }
};
export function createSession(options:SessionOptions,model:Model):(cycle:number)=>SessionBlock{
 const r=rng(options.seed);let previous=-1,cached:Phrase|undefined,lastCycle=-1;let remaining:number[]=[];
 const library=PROGRESSION_LIBRARY[options.minor?'minor':'major'][options.bars].map(parseProgression);
 return cycle=>{
  if(cycle!==lastCycle+1)throw new Error('練習区間の順序が不正です。');lastCycle=cycle;
  if(options.mode!=='endless'&&cycle%2===1)return {phrase:cached!,solo:false,label:'あなたの番'};
  let progression:Progression;
  if(options.mode==='trade'){
   const source=options.progression,offset=Math.floor(cycle/2)*options.bars;
   const bars=Array.from({length:options.bars},(_,i)=>source.changes.filter(c=>c.bar===(offset+i)%source.bars).map(c=>c.chord.symbol).join(' '));
   progression=parseProgression(bars.join(' | '));
  }else{
   if(!remaining.length)remaining=library.map((_,i)=>i);
   // Draw without replacement and vary the opening root when the remaining choices allow it.
   let choices=remaining.filter(i=>i!==previous&&(previous<0||library[i].changes[0].chord.root!==library[previous].changes[0].chord.root));
   if(!choices.length)choices=remaining.filter(i=>i!==previous);
   if(!choices.length)choices=remaining;
   const index=choices[Math.floor(r()*choices.length)];remaining.splice(remaining.indexOf(index),1);previous=index;
   progression=transposeProgression(library[index],options.key,options.key);
  }
  cached=generatePractice(progression,options.bpm,options.low,options.high,Math.floor(r()*4294967296),model,options.harmony);
  return {phrase:cached,solo:true,label:options.mode!=='endless'?'お手本':'連続演奏'};
 };
}
