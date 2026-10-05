import {Renderer,Stave,StaveNote,Voice,Formatter,Accidental,Beam,Tuplet,StaveTie,Dot} from 'vexflow/bravura';
import {pc,flatNames,sharpNames,transposeChord,type Phrase,type Note} from './music.ts';
export type ScoreOptions={transpose:number;clef:'treble'|'bass'};
export function spelling(pitch:number,flats:boolean){const name=(flats?flatNames:sharpNames)[pc(pitch)];return {key:name.toLowerCase()+'/'+(Math.floor(pitch/12)-1),accidental:name.slice(1),name};}
type Segment={start:number;duration:number;original:number;note:Note;continuation:boolean};
export function segments(phrase:Phrase,bar:number):Segment[]{
  const begin=bar*4,end=begin+4,result:Segment[]=[];
  phrase.notes.forEach((n,i)=>{
    let t=Math.max(begin,n.start),stop=Math.min(end,n.start+n.duration);
    if(stop-t<1e-7)return;
    while(stop-t>1e-7){
      let d=stop-t;
      if(!n.triplet)d=[4,3,2,1.5,1,.5,.25].find(v=>v<=d+1e-7&& (v<=1||Math.abs(t-Math.round(t))<1e-7))??d;
      result.push({start:t,duration:d,original:i,note:n,continuation:t>n.start+1e-7});t+=d;
    }
  });return result;
}
export function scoreNote(key:string,rest:boolean,clef:'treble'|'bass',duration:number,triplet=false){
  const dotted=Math.abs(duration-1.5)<1e-7||Math.abs(duration-3)<1e-7;
  const dur=triplet?'8':Math.abs(duration-4)<1e-7?'w':Math.abs(duration-3)<1e-7||Math.abs(duration-2)<1e-7?'h':duration>=1-1e-7?'q':duration>=.5-1e-7?'8':'16';
  // Visual dots alone do not extend VexFlow's ticks; duration needs the dots field too.
  const note=new StaveNote({keys:[key],duration:dur+(rest?'r':''),dots:dotted?1:0,clef,autoStem:true});
  return note;
}
export function drawScore(host:HTMLElement,phrase:Phrase,page:number,options:ScoreOptions){
  host.replaceChildren();const width=Math.max(140,(host.clientWidth-8)/2);const noteElements=new Map<number,SVGElement[]>();
  for(let bar=0;bar<phrase.progression.bars;bar++){
    const wrapper=document.createElement('div');wrapper.className='score-line';wrapper.dataset.bar=String(bar);host.append(wrapper);
    const renderer=new Renderer(wrapper,Renderer.Backends.SVG);const logicalWidth=Math.max(310,width);renderer.resize(logicalWidth,142);const ctx=renderer.getContext();ctx.setFillStyle('#202630');ctx.setStrokeStyle('#202630');
    const written=phrase.notes.filter(n=>n.pitch!==null&&n.start>=bar*4&&n.start<(bar+1)*4).map(n=>n.pitch!+options.transpose);
    const center=written.reduce((a,b)=>a+b,0)/Math.max(1,written.length);const target=options.clef==='treble'?73:52;
    const octave=written.length?Math.max(-2,Math.min(2,Math.trunc((center-target)/12)))*12:0;
    const stave=new Stave(1,27,logicalWidth-3);if(bar%2===0)stave.addClef(options.clef);if(bar===0)stave.addTimeSignature('4/4');stave.setContext(ctx).draw();
    const segs=segments(phrase,bar),staveNotes:StaveNote[]=[],tupletGroups:StaveNote[][]=[];let trip:StaveNote[]=[];
    const accidentals=new Map<string,string>();
    for(const s of segs){
      const n=s.note,chord=phrase.progression.changes.find(c=>s.start>=c.start&&s.start<c.start+c.duration)?.chord;
      const flats=!!chord&&(chord.symbol.includes('b')||(chord.minor&&!chord.symbol.includes('#')));
      const pitch=(n.pitch??(options.clef==='bass'?50:71))+options.transpose-octave;
      const spell=spelling(pitch,flats);const isRest=n.pitch===null;
      const sn=scoreNote(isRest?(options.clef==='bass'?'d/3':'b/4'):spell.key,isRest,options.clef,s.duration,!!n.triplet);
      if(Math.abs(s.duration-1.5)<1e-7||Math.abs(s.duration-3)<1e-7)Dot.buildAndAttach([sn],{all:true});
      if(!isRest){
        const letter=spell.key.replace(/[#b]/g,'');const last=accidentals.get(letter)??'';
        if(spell.accidental!==last){sn.addModifier(new Accidental(spell.accidental||'n'),0);accidentals.set(letter,spell.accidental);}
      }
      staveNotes.push(sn);
      if(n.triplet){trip.push(sn);if(trip.length===3){tupletGroups.push(trip);trip=[];}}
    }
    const tuplets=tupletGroups.map(ns=>new Tuplet(ns,{numNotes:3,notesOccupied:2,bracketed:false,ratioed:false}));
    const voice=new Voice({numBeats:4,beatValue:4}).addTickables(staveNotes);
    const beams=Beam.generateBeams(staveNotes,{beamRests:false,maintainStemDirections:false});
    new Formatter().joinVoices([voice]).formatToStave([voice],stave,{alignRests:true});voice.draw(ctx,stave);beams.forEach(b=>b.setContext(ctx).draw());tuplets.forEach(t=>t.setContext(ctx).draw());
    staveNotes.forEach((sn,i)=>{
      const el=sn.getSVGElement();if(el){el.classList.add('score-note');el.dataset.note=String(segs[i].original);el.dataset.pitch=segs[i].note.pitch===null?'rest':String(segs[i].note.pitch!+options.transpose);el.setAttribute('aria-label',segs[i].note.pitch===null?'休符':spelling(segs[i].note.pitch!+options.transpose,false).key);const list=noteElements.get(segs[i].original)??[];list.push(el);noteElements.set(segs[i].original,list);}
      if(segs[i].continuation&&segs[i].note.pitch!==null)new StaveTie({firstNote:i?staveNotes[i-1]:undefined,lastNote:sn,firstIndexes:[0],lastIndexes:[0]}).setContext(ctx).draw();
      if(i===segs.length-1&&segs[i].note.pitch!==null&&segs[i].note.start+segs[i].note.duration>(bar+1)*4+1e-7)new StaveTie({firstNote:sn,firstIndexes:[0],lastIndexes:[0]}).setContext(ctx).draw();
    });
    const svg=wrapper.querySelector('svg')!;svg.setAttribute('viewBox',`0 0 ${logicalWidth} 142`);svg.style.width='100%';svg.style.height='auto';svg.setAttribute('role','img');svg.setAttribute('aria-label',`${bar+1}小節目の五線譜${octave?`、記譜より${Math.abs(octave/12)}オクターブ${octave>0?'上':'下'}`:''}`);
    const text=(x:number,y:number,value:string,size:number,color:string)=>{const el=document.createElementNS('http://www.w3.org/2000/svg','text');el.setAttribute('x',String(x));el.setAttribute('y',String(y));el.setAttribute('font-size',String(size));el.setAttribute('font-family','ui-monospace, monospace');el.setAttribute('fill',color);el.textContent=value;svg.append(el);};
    text(4,20,String(bar+1).padStart(2,'0'),12,'#707887');
    if(octave)text(logicalWidth-43,17,Math.abs(octave)===12?(octave>0?'8va':'8vb'):(octave>0?'15ma':'15mb'),11,'#707887');
    const changes=phrase.progression.changes.filter(c=>c.bar===bar);
    for(const c of changes){const index=segs.findIndex(s=>s.start>=c.start-1e-7);const x=index>=0?staveNotes[index].getAbsoluteX():stave.getNoteStartX();text(Math.min(x,logicalWidth-52),27,transposeChord(c.chord,options.transpose),changes.length===4?12:14,'#315bb6');}
  }
  return {highlight(index:number){host.querySelectorAll('.sounding').forEach(el=>el.classList.remove('sounding'));host.querySelectorAll('.active-bar').forEach(el=>el.classList.remove('active-bar'));for(const el of noteElements.get(index)??[]){el.classList.add('sounding');el.closest('.score-line')?.classList.add('active-bar');}}};
}
