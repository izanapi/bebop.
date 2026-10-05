import test from 'node:test';import assert from 'node:assert/strict';import {Voice,Tuplet} from 'vexflow/bravura';import {readFileSync} from 'node:fs';
import {scoreNote,segments} from '../src/score.ts';import {generate,parseProgression,PRESETS} from '../src/music.ts';
const model=JSON.parse(readFileSync('public/research/model.json','utf8'));
test('actual engraving ticks fill every bar, including startup dotted rest and triplets',()=>{
 for(const preset of PRESETS)for(const seed of [20261005,1,3,5,17,42,99]){
  const p=generate(parseProgression(preset.text),140,60,84,seed,model);
  for(let bar=0;bar<p.progression.bars;bar++){
   const segs=segments(p,bar),notes=segs.map(s=>scoreNote('b/4',s.note.pitch===null,'treble',s.duration,!!s.note.triplet));let group:typeof notes=[];
   segs.forEach((s,i)=>{if(s.note.triplet){group.push(notes[i]);if(group.length===3){new Tuplet(group,{numNotes:3,notesOccupied:2});group=[];}}});assert.equal(group.length,0);
   const voice=new Voice({numBeats:4,beatValue:4}).addTickables(notes);assert(voice.isComplete(),`${preset.name} seed=${seed} bar=${bar+1}`);
  }
 }
});
test('dotted note and rest occupy one and a half times their base duration',()=>{
 for(const rest of [false,true]){const q=scoreNote('b/4',rest,'treble',1),dq=scoreNote('b/4',rest,'treble',1.5),dh=scoreNote('b/4',rest,'treble',3);assert.equal(dq.getTicks().value(),q.getTicks().value()*1.5);assert.equal(dh.getTicks().value(),q.getTicks().value()*3);}
});
