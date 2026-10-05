import {renderPCM,SAMPLE_RATE} from '../src/sound.ts';
import {perform,type Model,type Phrase} from '../src/music.ts';
let context:AudioContext|undefined,source:AudioBufferSourceNode|undefined;
const revision=document.body.dataset.comparison||'v2';
const [older,newer]=({v2:['v1','v2'],v21:['v2','v21'],v22:['v21','v22'],v23:['v22','v23'],v24:['v23','v24']} as Record<string,string[]>)[revision];
const examples=await (await fetch(`./comparison-${revision}.json`)).json();const model:Model=await(await fetch('./model.json')).json();
const select=document.querySelector<HTMLSelectElement>('#example')!,result=document.querySelector<HTMLElement>('#result')!;
const pairs=examples.filter((x:any)=>x.version===older);
pairs.forEach((x:any,i:number)=>select.add(new Option(`${x.title} · ${x.bpm} BPM · seed ${x.phrase.seed}`,String(i))));
function stop(){if(source){source.onended=null;source.stop();source=undefined;}result.textContent='停止';}
select.onchange=()=>{stop();document.querySelector('#answer')!.textContent='';};
for(const side of ['A','B'])document.querySelector<HTMLButtonElement>('#'+side)!.onclick=async()=>{
 try{stop();context??=new AudioContext();await context.resume();const pair=pairs[Number(select.value)],reverse=(pair.preset+pair.bpm/20)%2===0;const version=(side==='A')!==reverse?older:newer;const entry=examples.find((x:any)=>x.preset===pair.preset&&x.bpm===pair.bpm&&x.version===version);
 const phrase:Phrase={...entry.phrase,version:'bebop-grammar-2.0',notes:entry.phrase.notes.map((n:any)=>({...n,role:'line'}))};
 const events=perform(phrase,pair.bpm,model),pcm=renderPCM(events,phrase.progression.bars*4*60/pair.bpm+1),buffer=context.createBuffer(1,pcm.length,SAMPLE_RATE);buffer.getChannelData(0).set(pcm);source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);source.start();result.textContent=side+' 再生中';source.onended=()=>{result.textContent='停止';};
 }catch(e){result.textContent=String(e);}
};
document.querySelector<HTMLButtonElement>('#stop')!.onclick=stop;
document.querySelector<HTMLButtonElement>('#reveal')!.onclick=()=>{const p=pairs[Number(select.value)],r=(p.preset+p.bpm/20)%2===0;document.querySelector('#answer')!.textContent=`A：${r?'新版':'旧版'} ／ B：${r?'旧版':'新版'}`;};
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
