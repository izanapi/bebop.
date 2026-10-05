import {rng, type PerformanceEvent} from './music.ts';
export type Part=PerformanceEvent['part'];
export const SAMPLE_RATE=24000;
const cache=new Map<string,Float32Array>();
/** The identical deterministic instrument samples are used by browser and research renders. */
export function sample(part:Part,pitch:number):Float32Array {
  const key=`${part}:${pitch}`;const existing=cache.get(key);if(existing)return existing;
  const length=part==='click'?.07:part==='ride'?.6:part==='bass'?1.8:2.4;
  const a=new Float32Array(Math.ceil(length*SAMPLE_RATE)),random=rng(123+pitch);
  const f=440*2**((pitch-69)/12);let noiseLast=0;
  for(let i=0;i<a.length;i++){
    const t=i/SAMPLE_RATE;
    if(part==='ride'){
      const noise=random()*2-1,hp=noise-noiseLast;noiseLast=noise;
      a[i]=(hp*.21+Math.sin(2*Math.PI*4231*t)*.07+Math.sin(2*Math.PI*6477*t)*.045)*Math.exp(-t*12)*Math.min(1,t*2000);
    }else if(part==='click')a[i]=Math.sin(2*Math.PI*(pitch===84?1500:1050)*t)*Math.exp(-t*75)*.38;
    else{
      const weights=part==='bass'?[1,.32,.13,.045]:[1,.52,.25,.14,.06,.025];
      let v=0;
      weights.forEach((w,h)=>{const harmonic=h+1,freq=f*harmonic*Math.sqrt(1+.00004*harmonic*harmonic);if(freq<SAMPLE_RATE*.44)v+=w*Math.sin(2*Math.PI*freq*t)*Math.exp(-t*(part==='bass'?2.7:1.8+h*1.6));});
      a[i]=v*.23*Math.min(1,t/(part==='bass'?.008:.003));
    }
  }
  cache.set(key,a);return a;
}
export function renderPCM(events:PerformanceEvent[],lengthSeconds:number):Float32Array{
  const out=new Float32Array(Math.ceil(lengthSeconds*SAMPLE_RATE));
  const volumes={solo:.83,chords:.46,bass:.66,ride:.37,click:.7};
  for(const e of events){
    const a=sample(e.part,e.pitch),start=Math.round(e.time*SAMPLE_RATE),sustain=Math.max(.01,e.duration),release=e.part==='ride'?.12:.055;
    for(let j=0;j<a.length&&start+j<out.length&&j/SAMPLE_RATE<sustain+release;j++){
      const t=j/SAMPLE_RATE,g=t<sustain?1:Math.max(0,1-(t-sustain)/release);
      if(start+j>=0)out[start+j]+=a[j]*g*e.velocity*volumes[e.part]*.75;
    }
  }return out;
}
