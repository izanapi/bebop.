import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {createSession} from '../src/session.ts';
import {Player} from '../src/audio.ts';import {generate,parseProgression} from '../src/music.ts';
test('loop-off finishes the current cycle; stopping cancels scheduled nodes',async()=>{
  let tick:()=>void=()=>{},frame:()=>void=()=>{},scheduled=0,stopped=0;
  const param={value:1,setValueAtTime(){},linearRampToValueAtTime(){}};
  class Context{
    currentTime=0;state='running';destination={};onstatechange=()=>{};
    createGain(){return {gain:param,connect(){},disconnect(){}};}
    createDynamicsCompressor(){return {threshold:{value:0},ratio:{value:0},connect(){}};}
    createBuffer(){return {copyToChannel(){}};}
    createBufferSource(){return {buffer:null,onended:null,connect(){},disconnect(){},start(){scheduled++;},stop(){stopped++;}};}
    async resume(){}
  }
  const saved={window:(globalThis as any).window,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
  (globalThis as any).window={AudioContext:Context};(globalThis as any).setInterval=(fn:()=>void)=>{tick=fn;return 1;};(globalThis as any).clearInterval=()=>{};globalThis.requestAnimationFrame=(fn)=>{frame=()=>fn(0);return 1;};globalThis.cancelAnimationFrame=()=>{};
  try{
    const model=JSON.parse(readFileSync(new URL('../public/research/model.json',import.meta.url),'utf8'));const phrase=generate(parseProgression('Dm7 G7 | Cmaj7 |'),300,60,84,7,model),player=new Player();
    await player.start(phrase,300,model);const context=player.context! as unknown as Context;
    // 0.9 s count-in; 1.6 s per cycle. Change looping during cycle 3.
    context.currentTime=4.4;tick();frame();assert(player.playing);player.loop=false;frame();assert(player.playing,'must not stop immediately after the first cycle');
    context.currentTime=5.69;frame();assert(player.playing);context.currentTime=5.71;frame();assert(!player.playing);
    assert(scheduled>4);assert(stopped>=scheduled);player.stop();
    const provider=createSession({mode:'trade',bars:2,key:0,minor:false,seed:1,bpm:300,low:60,high:84,progression:phrase.progression},model);
    const scheduledEvents:any[]=[],shown:any[]=[];
    (player as any).schedule=(e:any,time:number)=>scheduledEvents.push({...e,time});
    player.onBlock=(b,c)=>shown.push({cycle:c,time:context.currentTime,solo:b.solo});
    context.currentTime=0;await player.start(phrase,300,model,provider);
    // Audio can be queued ahead, but the score must switch only on the real boundary.
    for(let t=0;t<2.49;t+=.025){context.currentTime=t;tick();frame();}
    assert.equal(shown.at(-1).cycle,0);context.currentTime=2.51;tick();frame();assert.equal(shown.at(-1).cycle,1);assert(!shown.at(-1).solo);
    for(let t=2.525;t<33;t+=.025){context.currentTime=t;tick();frame();}
    assert(player.playing,'session ignores ordinary loop-off');assert((player as any).blocks.size<=2,'old audio blocks must be released');
    const music=scheduledEvents.filter(e=>e.part!=='click');
    assert(music.some(e=>e.part==='solo'));assert(music.some(e=>e.part==='bass'&&Math.floor((e.time-.9+1e-6)/1.6)%2===1));
    assert(!music.some(e=>e.part==='solo'&&Math.floor((e.time-.9+1e-6)/1.6)%2===1),'answer blocks have no solo notes');
    assert.equal(scheduledEvents.filter(e=>e.part==='click').length,4,'count-in only once');
    const before=scheduledEvents.length;player.stop();tick();frame();assert.equal(scheduledEvents.length,before);assert.equal((player as any).blocks.size,0);
  }finally{Object.assign(globalThis,saved);}
});
