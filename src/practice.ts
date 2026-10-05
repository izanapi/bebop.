import {parseProgression,pc,flatNames,sharpNames,type Phrase,type Progression} from './music.ts';
export const KEY_NAMES=['C','D♭','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
export function transposeProgression(p:Progression,delta:number,target:number){
  const names=[1,3,5,8,10].includes(target)?flatNames:sharpNames;
  const bars=Array.from({length:p.bars},(_,bar)=>p.changes.filter(c=>c.bar===bar).map(({chord:c})=>names[pc(c.root+delta)]+c.suffix+(c.bass!==c.root?'/'+names[pc(c.bass+delta)]:'')).join(' '));
  return parseProgression(bars.join(' | ')+' |');
}
export function transposePhrase(p:Phrase,from:number,to:number):Phrase{
  let delta=pc(to-from+6)-6;
  if(p.low+delta<36)delta+=12;
  if(p.high+delta>96)delta-=12;
  if(p.low+delta<36||p.high+delta>96)throw new Error('この音域のまま移調できません。音域を狭めてから生成してください。');
  return {...p,...(p.originalProgression?{originalProgression:transposeProgression(p.originalProgression,delta,to)}:{}),progression:transposeProgression(p.progression,delta,to),notes:p.notes.map(n=>({...n,pitch:n.pitch===null?null:n.pitch+delta})),low:p.low+delta,high:p.high+delta};
}
export type SavedPhrase={id:string;name:string;createdAt:number;key:number;bpm:number;phrase:Phrase};
export function validateSaved(value:unknown):SavedPhrase{
  const v=value as SavedPhrase;
  if(!v||typeof v!=='object'||typeof v.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(v.id)||typeof v.name!=='string'||!v.name.trim()||v.name.length>80||!Number.isInteger(v.key)||v.key<0||v.key>11||!Number.isInteger(v.bpm)||v.bpm<60||v.bpm>300||!Number.isFinite(v.createdAt))throw new Error('保存データの形式が正しくありません。');
  const p=v.phrase;
  if(!p||typeof p.version!=='string'||p.version.length>100||!Number.isInteger(p.seed)||p.seed<0||p.seed>4294967295||!Number.isInteger(p.low)||!Number.isInteger(p.high)||p.low<36||p.high>96||p.high-p.low<12||!Number.isFinite(p.bpmAtGeneration)||p.bpmAtGeneration<60||p.bpmAtGeneration>300||!Array.isArray(p.notes)||p.notes.length>256||!p.notes.length)throw new Error('フレーズが不正です。');
  const progression=parseProgression(p.progression?.text);
  const originalProgression=p.originalProgression?parseProgression(p.originalProgression.text):undefined;
  if(originalProgression&&originalProgression.bars!==progression.bars)throw new Error('元の進行の小節数が一致しません。');
  let cursor=0;
  for(const n of p.notes){
    if(!Number.isFinite(n.start)||Math.abs(n.start-cursor)>1e-5||!Number.isFinite(n.duration)||n.duration<=0||n.duration>4||!(n.pitch===null||Number.isInteger(n.pitch)&&n.pitch>=p.low&&n.pitch<=p.high)||typeof n.role!=='string'||n.role.length>50||!Number.isInteger(n.phrase)||(n.triplet!==undefined&&typeof n.triplet!=='boolean'))throw new Error('音符データが不正です。');
    cursor+=n.duration;
  }
  if(Math.abs(cursor-progression.bars*4)>1e-5)throw new Error('小節の拍数が一致しません。');
  return {id:v.id,name:v.name.trim(),createdAt:v.createdAt,key:v.key,bpm:v.bpm,phrase:{...p,progression,...(originalProgression?{originalProgression}:{})}};
}
