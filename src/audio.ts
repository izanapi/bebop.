import {perform,type Model,type Phrase,type PerformanceEvent} from './music.ts';
import type {SessionBlock} from './session.ts';
import {sample,SAMPLE_RATE,type Part} from './sound.ts';
export type Mix={solo:number;chords:number;bass:number;ride:number};
export class Player {
  context?:AudioContext;master?:GainNode;private buffers=new Map<string,AudioBuffer>();private nodes=new Set<AudioBufferSourceNode>();
  private timer?:ReturnType<typeof setInterval>;private frame=0;private token=0;private timeline:PerformanceEvent[]=[];private index=0;private cycle=0;private origin=0;private duration=0;private beat=0;
  playing=false;private looping=true;private stopAfter=Infinity;mix:Mix={solo:.83,chords:.46,bass:.66,ride:.37};
  private provider?: (cycle:number)=>SessionBlock;
  private blocks=new Map<number,SessionBlock & {events:PerformanceEvent[]}>();private visibleCycle=-1;private sessionBpm=140;private sessionModel?:Model;
  onBlock:(block:SessionBlock,cycle:number)=>void=()=>{};
  get loop(){return this.looping;}
  set loop(value:boolean){this.looping=value;this.stopAfter=value?Infinity:this.playing?Math.max(1,Math.floor((this.context!.currentTime-this.origin)/this.duration)+1):1;}
  onPosition:(beat:number,note:number)=>void=()=>{};onStop:(reason?:string)=>void=()=>{};
  async start(phrase:Phrase,bpm:number,model:Model,provider?:(cycle:number)=>SessionBlock){
    this.stop();const request=++this.token;
    if(!this.context){
      const Constructor=window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;
      if(!Constructor)throw new Error('このブラウザは音声再生に対応していません。');
      this.context=new Constructor({latencyHint:'interactive'});this.master=this.context.createGain();this.master.gain.value=.75;
      const compressor=this.context.createDynamicsCompressor();compressor.threshold.value=-10;compressor.ratio.value=3;
      this.master.connect(compressor);compressor.connect(this.context.destination);
      this.context.onstatechange=()=>{if(this.playing&&this.context?.state!=='running')this.stop('音声が中断されました。再生を押すと再開します。');};
    }
    await this.context.resume();if(request!==this.token)return;
    if(this.context.state!=='running')throw new Error('音声を開始できませんでした。もう一度、再生を押してください。');
    this.provider=provider;this.sessionBpm=bpm;this.sessionModel=model;this.blocks.clear();this.visibleCycle=-1;
    if(provider){const first=this.getBlock(0);phrase=first.phrase;this.timeline=first.events;this.getBlock(1);}else this.timeline=perform(phrase,bpm,model);
    this.beat=60/bpm;this.duration=phrase.progression.bars*4*this.beat;
    // Prepare voice buffers before starting the audio clock to avoid an initial scheduling stall.
    this.timeline.forEach(e=>this.buffer(e.part,e.pitch));this.buffer('click',84);this.buffer('click',76);
    this.origin=this.context.currentTime+.10+4*this.beat;this.index=0;this.cycle=0;this.stopAfter=provider||this.loop?Infinity:1;this.playing=true;
    if(provider){this.visibleCycle=0;this.onBlock(this.getBlock(0),0);}
    for(let i=0;i<4;i++)this.schedule({time:0,duration:.06,pitch:i===0?84:76,velocity:.8,part:'click'},this.origin-(4-i)*this.beat);
    this.tick();this.timer=setInterval(()=>this.tick(),25);this.animate();
  }
  private getBlock(cycle:number){
    let block=this.blocks.get(cycle);if(!block){const next=this.provider!(cycle);
      if(this.blocks.size&&next.phrase.progression.bars!==this.blocks.values().next().value!.phrase.progression.bars)throw new Error('練習区間の長さが一致しません。');
      block={...next,events:perform(next.phrase,this.sessionBpm,this.sessionModel!).filter(e=>next.solo||e.part!=='solo')};
      this.blocks.set(cycle,block);block.events.forEach(e=>this.buffer(e.part,e.pitch));
    }return block;
  }
  private buffer(part:Part,pitch:number){
    const key=`${part}:${pitch}`;let b=this.buffers.get(key);
    if(!b){const data=sample(part,pitch);b=this.context!.createBuffer(1,data.length,SAMPLE_RATE);b.copyToChannel(data as Float32Array<ArrayBuffer>,0);this.buffers.set(key,b);}return b;
  }
  private schedule(e:PerformanceEvent,when:number){
    const volume=e.part==='click'?.7:this.mix[e.part];if(volume<=0)return;
    const ctx=this.context!,source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=this.buffer(e.part,e.pitch);
    gain.gain.setValueAtTime(e.velocity*volume,when);gain.gain.setValueAtTime(e.velocity*volume,when+e.duration);gain.gain.linearRampToValueAtTime(0,when+e.duration+.055);
    source.connect(gain);gain.connect(this.master!);source.start(when);source.stop(when+e.duration+.06);this.nodes.add(source);
    source.onended=()=>{source.disconnect();gain.disconnect();this.nodes.delete(source);};
  }
  private tick(){
    if(!this.playing)return;const now=this.context!.currentTime;
    if(now-this.origin>this.duration*this.stopAfter+.3){this.stop();return;}
    try { let count=0;
    while(count++<256){
      if(this.index>=(this.provider?this.getBlock(this.cycle).events:this.timeline).length){
        if(this.cycle+1>=this.stopAfter)break;this.index=0;this.cycle++;
      }
      const e=(this.provider?this.getBlock(this.cycle).events:this.timeline)[this.index];const when=this.origin+this.cycle*this.duration+e.time;
      if(when>now+.15)break;
      if(when>=now-.02)this.schedule(e,Math.max(now,when));this.index++;
    } }catch(e){this.stop((e as Error).message);}
  }
  private animate=()=>{
    if(!this.playing)return;const elapsed=this.context!.currentTime-this.origin;
    if(elapsed<0)this.onPosition(elapsed/this.beat,-1);
    else{
      if(elapsed>=this.duration*this.stopAfter){this.stop();return;}
      const cycle=Math.floor(elapsed/this.duration);
      let timeline=this.timeline;
      if(this.provider){try{const block=this.getBlock(cycle);timeline=block.events;
        if(cycle!==this.visibleCycle){this.visibleCycle=cycle;this.onBlock(block,cycle);this.getBlock(cycle+1);for(const k of this.blocks.keys())if(k<cycle)this.blocks.delete(k);}
      }catch(e){this.stop((e as Error).message);return;}}
      const pos=elapsed%this.duration;const solo=timeline.filter(e=>e.part==='solo'&&e.time<=pos&&e.time+e.duration>=pos).at(-1);
      this.onPosition(pos/this.beat,solo?.noteIndex??-1);
    }
    this.frame=requestAnimationFrame(this.animate);
  };
  stop(reason?:string){
    ++this.token;this.playing=false;this.provider=undefined;this.blocks.clear();clearInterval(this.timer);cancelAnimationFrame(this.frame);
    for(const n of this.nodes){try{n.stop();}catch{}n.disconnect();}this.nodes.clear();this.onStop(reason);
  }
}
