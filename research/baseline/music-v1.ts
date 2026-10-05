export const VERSION = 'bebop-grammar-1.0';
export type Chord = { symbol:string; root:number; suffix:string; bass:number; tones:number[]; scale:number[]; guides:number[]; minor:boolean };
export type Change = { chord:Chord; start:number; duration:number; bar:number };
export type Progression = { text:string; bars:number; changes:Change[] };
export type Note = { start:number; duration:number; pitch:number|null; role:string; phrase:number; triplet?:boolean };
export type Phrase = { seed:number; version:string; notes:Note[]; progression:Progression; bpmAtGeneration:number; low:number; high:number };
type Summary = { n:number; median:number|null; q25:number|null; q75:number|null };
export type Bin = {low:number;high:number;center:number;solos:number;on:Summary;off:Summary;gate:Summary;density:Summary};
export type Model = {version:string;intervalCounts:Record<string,number>;tempoBins:Bin[];aggregate:{density:Summary;gate:Summary;phraseBars:Summary};trainingIds:number[];testIds:number[]};
export const pc=(n:number)=>((n%12)+12)%12;
export const clamp=(v:number,a:number,b:number)=>Math.min(b,Math.max(a,v));
const roots:Record<string,number>={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
export const sharpNames=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
export const flatNames=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
export function parseChord(input:string):Chord {
  if((input.match(/\(/g)?.length??0)!==(input.match(/\)/g)?.length??0)||input.indexOf(')')>=0&&input.indexOf(')')<input.indexOf('('))throw new Error(`「${input}」の括弧を確認してください。`);
  let s=input.replaceAll('♭','b').replaceAll('♯','#').replaceAll('−','-').replaceAll('Δ','maj').replaceAll('△','maj').replaceAll('ø','m7b5').replaceAll('°','dim');
  const m=/^([A-Ga-g])([#b]?)(.*)$/.exec(s);
  if(!m)throw new Error(`「${input}」のルートを確認してください。例：Dm7、G7(b9)、Cmaj7`);
  const root=pc(roots[m[1].toUpperCase()]+(m[2]==='#'?1:m[2]==='b'?-1:0));
  let suffix=m[3],bass=root;
  const slash=/\/([A-Ga-g])([b#]?)$/.exec(suffix);
  if(slash){bass=pc(roots[slash[1].toUpperCase()]+(slash[2]==='#'?1:slash[2]==='b'?-1:0));suffix=suffix.slice(0,slash.index);}
  suffix=suffix.replaceAll('(','').replaceAll(')','').replaceAll(',','').replace(/^-/,'m').replace(/^mM(?:aj)?/,'mmaj').replace(/^M(?:aj)?/,'maj').replace(/^\+/,'aug').replace(/^o/,'dim').replace(/^m7b57$/,'m7b5');
  const match=/^(maj|m|dim|aug)?(6\/9|13|11|9|7|6)?(.*)$/.exec(suffix)!;
  const q=match[1]||'', ext=match[2]||'';let tail=match[3],sus=0,major7=q==='maj'&&['7','9','11','13'].includes(ext);
  if(q==='m'&&tail.startsWith('maj7')){major7=true;tail=tail.slice(4);}
  const alterations:Record<number,number[]>={};let alt=false;
  while(tail){
    const tok=/^(sus[24]?|add(?:9|11|13)|[#b](?:5|9|11|13)|alt)/.exec(tail);
    if(!tok)throw new Error(`「${input}」の「${tail}」は未対応です。コード表記を確認してください。`);
    const t=tok[0];tail=tail.slice(t.length);
    if(t.startsWith('sus'))sus=t==='sus2'?2:5;
    else if(t==='alt')alt=true;
    else if(t.startsWith('add')){const degree=+t.slice(3);alterations[degree]=[{9:2,11:5,13:9}[degree]!];}
    else {const degree=+t.slice(1);(alterations[degree]??=[]).push(pc(({5:7,9:2,11:5,13:9}[degree]??0)+(t[0]==='#'?1:-1)));}
  }
  if(alt&&!(ext==='7'||ext==='9'||ext==='13'))throw new Error('alt は属七の和音に指定してください。例：G7alt');
  const minor=q==='m'||q==='dim'; const third=sus|| (minor?3:4), fifth=q==='dim'?6:q==='aug'?8:7;
  let tones=[0,third,fifth];
  if(major7)tones.push(11);
  else if(['7','9','11','13'].includes(ext)||alt)tones.push(q==='dim'?9:10);
  if(ext==='6'||ext==='6/9')tones.push(9);
  if(['9','11','13','6/9'].includes(ext))tones.push(2);
  if(['11','13'].includes(ext))tones.push(5);
  if(ext==='13')tones.push(9);
  for(const [d,values] of Object.entries(alterations)){const natural=({5:7,9:2,11:5,13:9} as Record<string,number>)[d];tones=tones.filter(x=>x!==natural);tones.push(...values);}
  let scale=q==='dim'?[0,2,3,5,6,8,9,11]:minor?(tones.includes(11)?[0,2,3,5,7,9,11]:tones.includes(6)?[0,1,3,5,6,8,10]:[0,2,3,5,7,9,10]):tones.includes(10)?[0,2,4,5,7,9,10]:[0,2,4,5,7,9,11];
  for(const [d,values] of Object.entries(alterations)){const natural=({5:7,9:2,11:5,13:9} as Record<string,number>)[d];scale=scale.filter(x=>x!==natural);scale.push(...values);}
  if(alt){scale=[0,1,3,4,6,8,10];tones=[0,4,10,1,3,6,8];}
  if(sus)scale=scale.filter(x=>x!==4).concat(sus);
  if(q==='aug')scale=scale.filter(x=>x!==7).concat(8);
  const seventh=major7?11:tones.includes(10)?10:tones.includes(9)?9:fifth;
  return {symbol:input,root,suffix:m[3].replace(/\/[A-Ga-g][b#]?$/,''),bass,minor,tones:[...new Set(tones)].map(x=>pc(x+root)),scale:[...new Set(scale)].sort((a,b)=>a-b).map(x=>pc(x+root)),guides:[third,seventh].map(x=>pc(x+root))};
}
export function parseProgression(text:string):Progression {
  if(text.length>700)throw new Error('コード進行は2〜8小節で入力してください。');
  const clean=text.trim().replace(/^\|/,'').replace(/\|$/,'');
  const bars=clean.split('|').map(s=>s.trim());
  if(bars.length<2||bars.length>8)throw new Error('「|」で区切って、2〜8小節を入力してください。');
  const changes:Change[]=[];
  bars.forEach((bar,i)=>{
    const words=bar.split(/\s+/).filter(Boolean);
    if(![1,2,4].includes(words.length))throw new Error(`${i+1}小節目：1・2・4個のコードを入力してください。`);
    words.forEach((word,j)=>{try{changes.push({chord:parseChord(word),start:i*4+j*4/words.length,duration:4/words.length,bar:i});}catch(e){throw new Error(`${i+1}小節目：${(e as Error).message}`);}});
  });return {text,bars:bars.length,changes};
}
export function chordAt(p:Progression,t:number):Chord{return p.changes.find(c=>t>=c.start-1e-8&&t<c.start+c.duration-1e-8)?.chord??p.changes.at(-1)!.chord;}
export function transposeChord(c:Chord,amount:number):string{
  const names=c.symbol.includes('b')?flatNames:sharpNames;
  return names[pc(c.root+amount)]+c.suffix+(c.bass!==c.root?'/'+names[pc(c.bass+amount)]:'');
}
export function rng(seed:number){let a=seed>>>0;return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
function choose<T>(r:()=>number,arr:T[]):T{return arr[Math.floor(r()*arr.length)];}
function weighted<T>(r:()=>number,items:T[],weight:(x:T)=>number):T{
  const weights=items.map(x=>Math.max(.0001,weight(x)));let n=r()*weights.reduce((a,b)=>a+b,0);
  for(let i=0;i<items.length;i++){n-=weights[i];if(n<=0)return items[i];}return items.at(-1)!;
}
function pitches(pcs:number[],low:number,high:number){return Array.from({length:high-low+1},(_,i)=>low+i).filter(n=>pcs.includes(pc(n)));}
function nearest(pcs:number[],near:number,low:number,high:number){const pool=pitches(pcs,low,high);if(!pool.length)throw new Error('音域を1オクターブ以上に広げてください。');return pool.sort((a,b)=>Math.abs(a-near)-Math.abs(b-near))[0];}
export function timingProfile(bpm:number,model:Model){
  const valid=model.tempoBins.filter(b=>b.on.median!==null&&b.off.median!==null);
  const left=valid.filter(b=>b.center<=bpm).at(-1)??valid[0],right=valid.find(b=>b.center>=bpm)??valid.at(-1)!;
  const mix=left===right?0:clamp((bpm-left.center)/(right.center-left.center),0,1);
  const lerp=(a:number,b:number)=>a+(b-a)*mix;
  // Use measured solo on/off positions together; never apply an additional swing ratio.
  const on=clamp(lerp(left.on.median!,right.on.median!),0,.14);
  const off=clamp(lerp(left.off.median!,right.off.median!),.51,.72);
  const bin=model.tempoBins.find(b=>bpm>=b.low&&bpm<b.high);
  const estimated=!bin||Math.min(bin.on.n,bin.off.n)<5||bpm<valid[0].center||bpm>valid.at(-1)!.center;
  return {on,off,gate:clamp(lerp(left.gate.median??.87,right.gate.median??.87),.65,.95),estimated,samples:Math.min(bin?.on.n??0,bin?.off.n??0)};
}
export function generate(progression:Progression,bpm:number,low:number,high:number,seed:number,model:Model):Phrase {
  if(!Number.isFinite(bpm)||bpm<60||bpm>300)throw new Error('BPMは60〜300です。');
  if(!Number.isInteger(low)||!Number.isInteger(high)||low<36||high>96||high-low<12)throw new Error('音域はC2〜C7内で、1オクターブ以上にしてください。');
  const r=rng(seed),notes:Note[]=[];const total=progression.bars*4;
  let t=0,phraseID=0,last=nearest(chordAt(progression,0).tones,low+(high-low)*.4,low,high),previousInterval=0;
  const usedMotif=choose(r,['rise','fall','arch']);
  let rememberedIntervals:number[]=[];
  const stepWeight=Object.entries(model.intervalCounts).filter(([k])=>Math.abs(+k)>0&&Math.abs(+k)<=2).reduce((a,[,v])=>a+v,0);
  const arpWeight=Object.entries(model.intervalCounts).filter(([k])=>Math.abs(+k)>=3&&Math.abs(+k)<=5).reduce((a,[,v])=>a+v,0);
  const rest=(dur:number)=>{if(dur>1e-6){notes.push({start:t,duration:dur,pitch:null,role:'rest',phrase:phraseID});t+=dur;}};
  rest(choose(r,[0,.5,1]));
  while(t<total-1e-6){
    phraseID++;
    const phraseLength=Math.min(total-t,choose(r,[6,8,8,10,12]));
    const end=t+phraseLength;const tail=choose(r,[.5,.5,1,1]);const soundEnd=Math.max(t,end-tail);
    const start=t;let slots:Note[]=[];
    while(t<soundEnd-1e-6){
      const remaining=soundEnd-t;const beatRemain=1-(t%1);
      // Editorial rhythmic grammar; observed density controls the rate of long notes.
      const targetDensity=clamp(model.tempoBins.find(b=>bpm>=b.low&&bpm<b.high)?.density.median??1.7,1.3,2.1);
      let ds:number[];
      if(remaining<=.5||beatRemain<.99)ds=[Math.min(.5,remaining,beatRemain)];
      else if(r()<.055&&bpm<220&&remaining>=1)ds=[1/3,1/3,1/3];
      else if(r()<(2-targetDensity)*.42&&remaining>=1)ds=[1];
      else ds=[.5,.5];
      for(const d of ds){if(t+d>soundEnd+1e-6)break;slots.push({start:t,duration:d,pitch:0,role:'line',phrase:phraseID,triplet:ds.length===3});t+=d;}
    }
    // Shape first, then select pitches; short motives recur as transformed contours.
    const motif=phraseID%2?usedMotif:choose(r,[usedMotif,'fall','arch']);
    let atom:'step'|'arpeggio'='step';const currentIntervals:number[]=[];
    for(let i=0;i<slots.length;i++){
      const n=slots[i],c=chordAt(progression,n.start),progress=(n.start-start)/Math.max(1,soundEnd-start);
      const contour=motif==='rise'?progress:motif==='fall'?1-progress:Math.sin(progress*Math.PI);
      const preferred=low+(high-low)*(.22+.55*contour);
      const isLanding=i===slots.length-1;
      const boundary=progression.changes.some(ch=>Math.abs(ch.start-n.start)<.01);
      const strong=Math.abs(n.start-Math.round(n.start))<.01;
      if(i%3===0)atom=weighted(r,['step','arpeggio'] as const,a=>a==='step'?stepWeight:arpWeight*.65);
      let pool=pitches(isLanding?c.tones:boundary?c.guides:atom==='arpeggio'?c.tones:strong&&r()<.6?c.tones:c.scale,low,high);
      const nextC=chordAt(progression,Math.min(total-.001,n.start+n.duration));
      const nextGuide=nearest(nextC.guides,last,low,high);
      n.pitch=weighted(r,pool,p=>{
        const delta=p-last;const obs=(model.intervalCounts[String(delta)]??1)+10;
        const contourWeight=Math.exp(-Math.abs(p-preferred)*.20);
        const leapPenalty=Math.abs(delta)>7?.02:Math.abs(delta)>5?.3:1;
        const repeatPenalty=delta===0?.28:1;
        const recover=Math.abs(previousInterval)>=5&&Math.sign(delta)===Math.sign(previousInterval)?.15:1;
        const connection=nextC!==c?Math.exp(-Math.abs(p-nextGuide)*.16):1;
        const grammar=atom==='step'?(Math.abs(delta)<=2?2.2:.55):(Math.abs(delta)>=3&&Math.abs(delta)<=5?2.4:.65);
        const echo=phraseID>1&&i<rememberedIntervals.length&&motif===usedMotif?Math.exp(-Math.abs(delta-rememberedIntervals[i])*.35):1;
        return Math.pow(obs,.5)*contourWeight*leapPenalty*repeatPenalty*recover*connection*grammar*echo;
      });
      n.role=isLanding?'landing':boundary?'guide':atom;previousInterval=n.pitch-last;currentIntervals.push(previousInterval);last=n.pitch;
    }
    if(!rememberedIntervals.length)rememberedIntervals=currentIntervals.slice(0,6);
    // Resolve every added chromatic atom into a selected target, including across chords.
    for(let i=2;i<slots.length;i++){
      const target=slots[i];if(target.triplet||slots[i-1].triplet||slots[i-2].triplet)continue;
      if(slots.slice(i-2,i+1).some(n=>['enclosure','approach','resolution'].includes(n.role)))continue;
      if(target.start%1!==0||target.pitch===null||slots[i-1].duration!==.5)continue;
      if(r()<.38){
        const p=target.pitch,upper=p+choose(r,[1,2]),lower=p-1;
        const before=slots[i-3]?.pitch??p;
        if(i>=2&&slots[i-2].duration===.5&&upper<=high&&lower>=low&&Math.abs(upper-before!)<=7&&r()<.55){
          slots[i-2].pitch=upper;slots[i-2].role='enclosure';slots[i-1].pitch=lower;slots[i-1].role='approach';target.role='resolution';
        }else{
          const ap=p+(r()<.65?-1:1);
          if(ap>=low&&ap<=high&&Math.abs(ap-slots[i-2].pitch!)<=7){slots[i-1].pitch=ap;slots[i-1].role='approach';target.role='resolution';}
        }
      }
    }
    notes.push(...slots);last=slots.at(-1)?.pitch??last;rest(end-t);
  }
  return {seed:seed>>>0,version:VERSION+' / '+model.version,notes,progression,bpmAtGeneration:bpm,low,high};
}
export type TimingMode='model'|'straight'|'triplet';
export type PerformanceEvent={time:number;duration:number;pitch:number;velocity:number;part:'solo'|'chords'|'bass'|'ride'|'click';noteIndex?:number};
export function perform(phrase:Phrase,bpm:number,model:Model,mode:TimingMode='model'):PerformanceEvent[]{
  const profile=timingProfile(bpm,model),beat=60/bpm;const total=phrase.progression.bars*4;const events:PerformanceEvent[]=[];
  const warp=(t:number,solo:boolean,triplet=false)=>{
    const whole=Math.floor(t+1e-8),f=t-whole;
    if(mode==='straight')return t;
    if(mode==='triplet')return whole+(f<=.5?f*4/3:2/3+(f-.5)*2/3);
    if(triplet)return t; // True triplets retain their own grid; data did not fit their microtiming.
    const a=solo?profile.on:0,b=profile.off;
    return whole+(f<=.5?a+(b-a)*f*2:b+(1+a-b)*(f-.5)*2);
  };
  phrase.notes.forEach((n,i)=>{
    if(n.pitch===null)return;
    const start=warp(n.start,true,n.triplet),end=warp(n.start+n.duration,true,n.triplet);
    const next=phrase.notes[i+1];const nextStart=next?warp(next.start,true,next.triplet):total;
    const duration=Math.max(.025,Math.min((end-start)*profile.gate, nextStart-start-.015, total-start)*beat);
    events.push({time:start*beat,duration,pitch:n.pitch,velocity:n.role==='landing'?.69:n.start%1===.5?.83:.74,part:'solo',noteIndex:i});
  });
  let previousBass=43;let previousVoicing=[52,58,62];
  for(let b=0;b<total;b++){
    const c=chordAt(phrase.progression,b),next=chordAt(phrase.progression,Math.min(total-.001,b+1));
    const candidates=pitches(b%4===0?[c.bass]:b%4===3&&next!==c?[pc(next.bass-1)]:c.tones,36,55);
    const bass=candidates.sort((a,z)=>Math.abs(a-previousBass)-Math.abs(z-previousBass))[0];previousBass=bass;
    events.push({time:b*beat,duration:beat*.84,pitch:bass,velocity:.6,part:'bass'});
    events.push({time:b*beat,duration:beat*.32,pitch:51,velocity:b%2?.48:.32,part:'ride'});
    if(b%2===1)events.push({time:warp(b+.5,false)*beat,duration:beat*.2,pitch:51,velocity:.27,part:'ride'});
    if(b%4===0||b%4===2||phrase.progression.changes.some(x=>x.start===b)){
      const pcs=[...new Set([...c.guides,...c.tones.filter(x=>x!==c.root)])].slice(0,3);
      const voicing=pcs.map((p,i)=>nearest([p],previousVoicing[i]??60,48,70));previousVoicing=voicing;
      voicing.forEach(pitch=>events.push({time:warp(b+(b%4===2?.5:0),false)*beat,duration:beat*.65,pitch,velocity:.34,part:'chords'}));
    }
  }
  return events.sort((a,b)=>a.time-b.time);
}
export const PRESETS=[
  {name:'ii–V–I / major',text:'Dm7 | G7 | Cmaj7 | C6 |',note:'長調のii–V–I。練習用に4小節へ展開。'},
  {name:'ii–V–i / minor',text:'Dm7b5 | G7(b9) | Cm6 | Cm6 |',note:'短調のii–V–i。練習用の標準形。'},
  {name:'turnaround',text:'Cmaj7 A7 | Dm7 G7 | Cmaj7 A7 | Dm7 G7 |',note:'I–VI7–ii–V。練習用の反復。'},
  {name:'ii–V cycle',text:'Dm7 G7 | Cmaj7 | Cm7 F7 | Bbmaj7 | Bbm7 Eb7 | Abmaj7 | Abm7 Db7 | Gbmaj7 |',note:'全音下降するii–V。練習用に構成。'},
  {name:'blues / ending',text:'Gm7 | C7 | F7 | C7 |',note:'WJazzD: Parker「Billie’s Bounce」終盤4小節の和声骨格。旋律は新規生成。'},
  {name:'rhythm changes / A',text:'Bb6 G7 | Cm7 F7 | Dm7 G7 | Cm7 F7 | Fm7 Bb7 | Eb6 Edim7 | Bb6 G7 | Cm7 F7 |',note:'リズムチェンジA部の練習用リハーモナイズ。採譜の逐語的転載ではありません。'},
];
