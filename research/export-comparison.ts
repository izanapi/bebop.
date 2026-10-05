import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {renderPCM,SAMPLE_RATE} from '../src/sound.ts';import {perform} from '../src/music.ts';
const model=JSON.parse(readFileSync('public/research/model.json','utf8')),examples=JSON.parse(readFileSync(process.argv[3]||'public/research/comparison-v2.json','utf8'));
const dir=process.argv[2]||'../../outputs/bebop-comparison';mkdirSync(dir,{recursive:true});
for(const entry of examples.filter((x:any)=>x.preset===0)){
 const phrase={...entry.phrase,version:'bebop-grammar-2.0',notes:entry.phrase.notes.map((n:any)=>({...n,role:'line'}))};
 const pcm=renderPCM(perform(phrase,entry.bpm,model),phrase.progression.bars*4*60/entry.bpm+1);const data=Buffer.alloc(44+pcm.length*2);
 data.write('RIFF');data.writeUInt32LE(data.length-8,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);data.writeUInt32LE(SAMPLE_RATE,24);data.writeUInt32LE(SAMPLE_RATE*2,28);data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(pcm.length*2,40);
 for(let i=0;i<pcm.length;i++)data.writeInt16LE(Math.round(Math.max(-1,Math.min(1,pcm[i]))*32767),44+i*2);
 writeFileSync(`${dir}/major-${entry.bpm}-${entry.version}.wav`,data);
}
