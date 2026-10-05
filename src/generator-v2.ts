import {chordAt,pc,rng,type Model,type Note,type Phrase,type Progression} from './music.ts';
type Stats={n:number;median:number|null;q25:number|null;q75:number|null};
export type Syntax={version:string;tripletBeatRate:number;intervals:Record<string,number>;bigram:Record<string,Record<string,number>>;trigram:Record<string,Record<string,number>>;rhythms:{durations:number[];count:number;solos:number}[];startPhases:Record<string,number>;ensemble:{low:number;high:number;tracks:number;performers:number;pianoDrumLag:Stats;soloOff:Stats;drumOff:Stats}[]};
const sum=(a:number[])=>a.reduce((s,x)=>s+x,0);
function pick<T>(r:()=>number,a:T[],weight:(v:T)=>number){const w=a.map(weight);let t=r()*sum(w);for(let i=0;i<a.length;i++){t-=w[i];if(t<=0)return a[i];}return a.at(-1)!;}
function probability(counts:Record<string,number>|undefined,d:number,prior:number,strength:number){if(!counts)return prior;const n=sum(Object.values(counts));return ((counts[d]??0)+strength*prior)/(n+strength);}
export function generatePhraseV2(progression:Progression,bpm:number,low:number,high:number,seed:number,model:Model):Phrase{
 if(!Number.isFinite(bpm)||bpm<60||bpm>300)throw new Error('BPMは60〜300です。');
 if(!Number.isInteger(low)||!Number.isInteger(high)||low<36||high>96||high-low<12)throw new Error('音域はC2〜C7内で、1オクターブ以上にしてください。');
 const syntax=model.syntax!,random=rng(seed),notes:Note[]=[],total=progression.bars*4;
 const pool=Array.from({length:high-low+1},(_,i)=>low+i),center=(low+high)/2;
 const nearest=(pcs:number[],near:number)=>pool.filter(p=>pcs.includes(pc(p))).sort((a,b)=>Math.abs(a-near)-Math.abs(b-near))[0];
 let t=0,id=0,last=nearest(chordAt(progression,0).tones,center-3),motif:number[]=[];
 const rest=(d:number)=>{if(d>0){notes.push({start:t,duration:d,pitch:null,role:'rest',phrase:id});t+=d;}};
 // Pickups are phrase-level decisions; no compulsory restart at a bar line.
 rest(pick(random,[0,.5,1,1.5],x=>x===0?3:x===.5?5:1));
 while(t<total-1e-6){
  id++;const remaining=total-t;
  if(remaining<1){rest(remaining);break;}
  const maxSpan=Math.min(12,remaining),templates=syntax.rhythms.filter(x=>sum(x.durations)<=maxSpan&&sum(x.durations)>=Math.min(3,maxSpan));
  let durations=templates.length?[...pick(random,templates,x=>Math.sqrt(x.count)*(sum(x.durations)<4?.5:1)*(bpm<110?Math.pow(sum(x.durations)/x.durations.length,1.5):1)).durations]:Array(Math.floor(maxSpan*2)).fill(.5);
  // A related response keeps the interval contour, while the rhythm and cadence can change.
  const answer=id%2===0&&motif.length>=3&&random()<.7;
  if(bpm<100&&durations.length>8){durations=durations.slice(0,8);}
  if(sum(durations)>remaining)durations=durations.slice(0,Math.floor(remaining*2));
  let cursor=t;
  for(let j=0;j<durations.length-1;j++){
    if(durations[j]===.5&&durations[j+1]===.5&&Math.abs(cursor-Math.round(cursor))<1e-6&&bpm<240&&random()<Math.min(.10,syntax.tripletBeatRate??.04)){
      durations.splice(j,2,1/3,1/3,1/3);j+=2;cursor+=1;
    }else cursor+=durations[j];
  }
  const slots:Note[]=durations.map((duration,i)=>({start:t+sum(durations.slice(0,i)),duration,pitch:0,role:'line',phrase:id,triplet:Math.abs(duration-1/3)<1e-8}));
  if(!slots.length){rest(remaining);break;}
  const end=t+sum(durations),endChord=chordAt(progression,Math.min(total-.001,slots.at(-1)!.start));
  const direction=random()<.5?-1:1,peak=Math.max(low+3,Math.min(high-3,center+direction*(2+random()*4)));
  const target=nearest([...endChord.guides,endChord.root],center+direction*2);
  type Path={pitches:number[];intervals:number[];score:number};let beam:Path[]=[{pitches:[],intervals:[],score:0}];
  for(let i=0;i<slots.length;i++){
   const n=slots[i],c=chordAt(progression,n.start),strong=Math.abs(n.start%1)<1e-6,isEnd=i===slots.length-1;
   const expected=center+(peak-center)*Math.sin((i+1)/(slots.length+1)*Math.PI);
   const noise=new Map(pool.map(p=>[p,-Math.log(-Math.log(Math.max(1e-9,random())))*.6]));
   const expanded:Path[]=[];
   for(const path of beam){
    const prev=path.pitches.at(-1)??last,prevD=path.intervals.at(-1),prev2=path.intervals.at(-2);
    for(const p of pool){
     const d=p-prev,abs=Math.abs(d);if(abs>12||i===0&&abs>9)continue;
     const ct=c.tones.includes(pc(p)),sc=c.scale.includes(pc(p)),guide=c.guides.includes(pc(p));
     if(isEnd&&!ct)continue;
     if(!sc&&(strong||n.duration>0.5))continue;
     let prob=probability(syntax.intervals,d,1/25,8);
     if(prevD!==undefined)prob=probability(syntax.bigram[String(prevD)],d,prob,30);
     if(prev2!==undefined)prob=probability(syntax.trigram[`${prev2},${prevD}`],d,prob,40);
     let score=path.score+Math.log(Math.max(.00001,prob))*.95+(noise.get(p)??0);
     score+=(guide?.35:ct?.15:sc?-.15:-1.1)*(strong?1.7:1);
     score-=Math.abs(p-expected)*.045;
     if(abs>7)score-=.45;if(abs===0)score-=.5;
     if(i>=2&&p===path.pitches[i-2]&&abs<=2)score-=.75; // avoid endless neighbour oscillation
     if(prevD!==undefined&&Math.abs(prevD)>=5&&Math.sign(d)===Math.sign(prevD)&&d!==0)score-=.7;
     if(n.duration>=1&&!ct)score-=1.7;
     // Natural 11 over a major-third chord is a passing tone, not a sustained landing.
     if(pc(p-c.root)===5&&c.tones.includes(pc(c.root+4))&&(strong||n.duration>=1))score-=1.4;
     if(i){const old=slots[i-1],oldChord=chordAt(progression,old.start);if(!oldChord.scale.includes(pc(prev))&&abs!==1)score-=3.2;}
     const stepsLeft=slots.length-i-1;if(stepsLeft<4)score-=Math.max(0,Math.abs(p-target)-stepsLeft*2)*.28;
     if(isEnd)score-=Math.abs(p-target)*.25;
     if(answer&&i>0&&i<=motif.length){const expectedD=motif[i-1];score-=Math.abs(d-expectedD)*.24;}
     // At a chord change prefer a short voice-leading connection, without resetting the melody.
     if(i&&chordAt(progression,slots[i-1].start)!==c&&strong){score+=guide?.45:0;if(abs>5)score-=.8;}
     expanded.push({pitches:[...path.pitches,p],intervals:[...path.intervals,d].slice(-3),score});
    }
   }
   expanded.sort((a,b)=>b.score-a.score);beam=expanded.slice(0,14);
  }
  const best=pick(random,beam.slice(0,5),p=>Math.exp(p.score-beam[0].score));
  slots.forEach((n,i)=>{n.pitch=best.pitches[i];const c=chordAt(progression,n.start);n.role=i===slots.length-1?'landing':!c.scale.includes(pc(n.pitch))&&Math.abs(best.pitches[i+1]-n.pitch)===1?'approach':c.guides.includes(pc(n.pitch))?'guide':answer?'answer':'line';});
  if(id%2===1)motif=best.pitches.slice(1,7).map((p,i)=>p-best.pitches[i]);
  notes.push(...slots);t=end;last=best.pitches.at(-1)!;
  // Long endings, pickups and phrase gaps are separate from note articulation.
  const gap=pick(random,[0,.5,1,1.5,2],x=>x===.5?5:x===1?3:1);
  rest(Math.min(gap,total-t));
 }
 return {seed:seed>>>0,version:'bebop-grammar-2.0 / '+model.version,notes,progression,bpmAtGeneration:bpm,low,high};
}
