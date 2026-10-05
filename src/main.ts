import {generatePractice,harmonyChanges,type HarmonyMode} from './reharmony.ts';
import {KEY_NAMES,transposeProgression,transposePhrase,validateSaved,type SavedPhrase} from './practice.ts';
import {parseProgression,generate,PRESETS,timingProfile,sharpNames,type Model,type Phrase} from './music.ts';
import {createSession} from './session.ts';
import {Player} from './audio.ts';
import {drawScore,type ScoreOptions} from './score.ts';
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const input=$<HTMLTextAreaElement>('chords'),bpmInput=$<HTMLInputElement>('bpm'),play=$<HTMLButtonElement>('play'),gen=$<HTMLButtonElement>('generate');
const player=new Player();let model:Model,phrase:Phrase,page=0,count=0,low=60,high=84,options:ScoreOptions={transpose:0,clef:'treble'};let score:ReturnType<typeof drawScore>|undefined;let pending=false;
const status=(s:string)=>{$('status').textContent=s;};
const error=(s:string)=>{$('error').textContent=s;$('error').hidden=!s;};
const readBpm=()=>{const n=Number(bpmInput.value);if(!Number.isInteger(n)||n<60||n>300)throw new Error('BPMは60〜300の整数で入力してください。');return n;};
const harmony=$<HTMLSelectElement>('harmony-mode');
harmony.addEventListener('change',()=>{try{newPhrase();}catch(e){error((e as Error).message);}});
function redraw(){
  if(!phrase)return;
  const changes=harmonyChanges(phrase);$('harmony-note').hidden=!phrase.originalProgression;
  $('harmony-note').textContent=changes.length?changes.map(c=>`${c.bar+1}小節${c.beat}拍：${c.from} → ${c.to}`).join(' / ')+' · 伴奏も変更': '元の進行 · 旋律の音使いで冒険';
  score=drawScore($('score'),phrase,0,options);
  const pitches=phrase.notes.flatMap(n=>n.pitch===null?[]:[n.pitch]);
  const pitchName=(p:number)=>sharpNames[p%12]+(Math.floor(p/12)-1);
  $('page-indicator').textContent=`${phrase.progression.bars}小節 · 実音 ${pitchName(Math.min(...pitches))}–${pitchName(Math.max(...pitches))}`;
  $('notation-label').textContent=`${({0:'C',2:'B♭',9:'E♭',7:'F'} as Record<number,string>)[options.transpose]} · ${options.clef}`;
}
function updateTiming(){try{const p=timingProfile(readBpm(),model,!!phrase&&!phrase.version.startsWith('bebop-grammar-2.'));$('timing-status').textContent=`タイム感：${p.estimated?'推定':'データ参照'}`;$('timing-status').title=`このテンポ帯の参照演奏 ${p.samples}。表拍 ${p.on.toFixed(3)}、裏拍 ${p.off.toFixed(3)}（拍単位）`;}catch{}}
function newPhrase(seed=crypto.getRandomValues(new Uint32Array(1))[0]){
  const parsed=parseProgression(input.value),bpm=readBpm();
  const next=generatePractice(parsed,bpm,low,high,seed,model,harmony.value as HarmonyMode);
  player.stop();phrase=next;page=0;count++;error('');
  $('phrase-number').textContent=`phrase ${String(count).padStart(3,'0')}`;$('bar-count').textContent=`${parsed.bars} bars`;
  $('seed-label').textContent=`#${phrase.seed}`;$<HTMLInputElement>('seed-input').value=String(phrase.seed);$('version').textContent=phrase.version;
  currentFavorite=null;play.disabled=false;updateSave();redraw();updateTiming();status('1小節カウントイン');
  return {seed:phrase.seed,version:phrase.version,bars:phrase.progression.bars,noteCount:phrase.notes.filter(n=>n.pitch!==null).length};
}
gen.addEventListener('click',()=>{try{newPhrase();}catch(e){error((e as Error).message);}});
input.addEventListener('input',()=>{player.stop();play.disabled=true;$<HTMLButtonElement>('favorite-save').disabled=true;preset.value='custom';$('key-mode').textContent='移調の基準';$('preset-note').textContent='手入力したコード進行です。';status('編集した進行で「生成」');error('');});
const preset=$<HTMLSelectElement>('preset');
PRESETS.forEach((p,i)=>{const o=new Option(p.name,String(i));preset.add(o);});
preset.add(new Option('手入力','custom'));
preset.addEventListener('change',()=>{if(preset.value==='custom'){input.focus();return;}const p=PRESETS[Number(preset.value)];const base=Number(preset.value)===4?5:Number(preset.value)===5?10:0;input.value=transposeProgression(parseProgression(p.text),Number(keySelect.value)-base,Number(keySelect.value)).text;$('key-mode').textContent=Number(preset.value)===1?'minor':'major';$('preset-note').textContent=p.note;try{newPhrase();}catch(e){error((e as Error).message);}});
$('preset-note').textContent=PRESETS[0].note;
player.onStop=(reason)=>{play.textContent='再生';play.setAttribute('aria-pressed','false');score?.highlight(-1);if(reason)status(reason);else status('1小節カウントイン');};
const sessionMode=$<HTMLSelectElement>('session-mode'),sessionBars=$<HTMLSelectElement>('session-bars'),sessionTonality=$<HTMLSelectElement>('session-tonality');
let blockLabel='';
function sessionChanged(){player.stop();blockLabel='';const mode=sessionMode.value;sessionBars.hidden=mode==='normal';sessionTonality.hidden=mode!=='endless'&&mode!=='trade-random';$<HTMLButtonElement>('loop').disabled=mode!=='normal';$('session-hint').hidden=mode==='normal';$('session-hint').textContent=mode==='trade'?'入力進行で お手本 → あなたの番':mode==='trade-random'?'新しい進行でお手本 → 同じ進行であなたの番':'いろいろな出だしで進行・フレーズを自動更新';}
for(const el of [sessionMode,sessionBars,sessionTonality])el.addEventListener('change',sessionChanged);
player.onBlock=(block,cycle)=>{phrase=block.phrase;blockLabel=block.label;
 if(sessionMode.value==='endless'||sessionMode.value==='trade-random'){input.value=(phrase.originalProgression??phrase.progression).text;preset.value='custom';$('preset-note').textContent='自動生成した練習用進行です。';$('key-mode').textContent=sessionTonality.value==='minor'?'minor':'major';}
 $('phrase-number').textContent=`${block.label} · ${cycle+1}`;$('bar-count').textContent=`${phrase.progression.bars} bars`;$('seed-label').textContent=`#${phrase.seed}`;$('version').textContent=phrase.version;$<HTMLInputElement>('seed-input').value=String(phrase.seed);currentFavorite=null;updateSave();redraw();
};
player.onPosition=(beat,note)=>{
  if(beat<0){status(`カウント ${Math.max(1,Math.min(4,Math.floor(beat+4)+1))} / 4`);return;}
  score?.highlight(note);status(`${sessionMode.value!=='normal'?blockLabel+' · ':''}${Math.floor(beat/4)+1}小節 · ${Math.floor(beat%4)+1}拍`);
};
play.addEventListener('click',async()=>{
  if(player.playing||pending){pending=false;player.stop();return;}
  try{error('');const bpm=readBpm();pending=true;play.textContent='準備中';const provider=sessionMode.value==='normal'?undefined:createSession({mode:sessionMode.value as 'trade'|'trade-random'|'endless',harmony:harmony.value as HarmonyMode,bars:Number(sessionBars.value) as 2|4,key:currentKey,minor:sessionTonality.value==='minor',seed:crypto.getRandomValues(new Uint32Array(1))[0],bpm,low,high,progression:parseProgression(input.value)},model);await player.start(phrase,bpm,model,provider);if(player.playing){play.textContent='停止';play.setAttribute('aria-pressed','true');}}
  catch(e){player.stop();error((e as Error).message);play.textContent='再生';}finally{pending=false;}
});
$('loop').addEventListener('click',()=>{player.loop=!player.loop;$('loop').setAttribute('aria-pressed',String(player.loop));$('loop').textContent=`ループ ${player.loop?'ON':'OFF'}`;});
function changeTempo(delta=0){
  try{if(delta)bpmInput.value=String(Math.max(60,Math.min(300,(Number(bpmInput.value)||140)+delta)));readBpm();player.stop();currentFavorite=null;updateSave();updateTiming();error('');status('音列はそのまま · 再生で確認');}catch(e){error((e as Error).message);}
}
bpmInput.addEventListener('change',()=>changeTempo());$('slower').addEventListener('click',()=>changeTempo(-5));$('faster').addEventListener('click',()=>changeTempo(5));
for(const id of ['settings','research'])$(id+'-open').addEventListener('click',()=>{player.stop();if(id==='settings')syncRangePreset();$<HTMLDialogElement>(id).showModal();});
document.querySelectorAll<HTMLButtonElement>('[data-close]').forEach(b=>b.addEventListener('click',()=>$<HTMLDialogElement>(b.dataset.close!).close()));
for(const id of ['low','high']){
  const el=$<HTMLSelectElement>(id);for(let n=36;n<=96;n++){el.add(new Option(`${sharpNames[n%12]}${Math.floor(n/12)-1}`,String(n)));}el.value=String(id==='low'?60:84);
}
const rangePreset=$<HTMLSelectElement>('range-preset');
function syncRangePreset(){const value=$<HTMLSelectElement>('low').value+','+$<HTMLSelectElement>('high').value;rangePreset.value=Array.from(rangePreset.options).some(o=>o.value===value)?value:'custom';}
rangePreset.addEventListener('change',()=>{if(rangePreset.value==='custom')return;const [a,b]=rangePreset.value.split(',');$<HTMLSelectElement>('low').value=a;$<HTMLSelectElement>('high').value=b;});
for(const id of ['low','high'])$(id).addEventListener('change',syncRangePreset);
for(const [part,label] of [['solo','フレーズ'],['chords','コード'],['bass','ベース'],['ride','ライド']] as const){
  const row=document.createElement('div');row.className='mix-row';row.innerHTML=`<label><input id="${part}-on" type="checkbox" checked>${label}</label><input id="${part}-volume" type="range" min="0" max="100" value="${Math.round(player.mix[part]*100)}" aria-label="${label}の音量"><output id="${part}-value">${Math.round(player.mix[part]*100)}</output>`;$('mix-controls').append(row);
  $<HTMLInputElement>(`${part}-volume`).addEventListener('input',()=>{$(`${part}-value`).textContent=$<HTMLInputElement>(`${part}-volume`).value;});
}
$('settings-form').addEventListener('submit',e=>{
  e.preventDefault();const newLow=Number($<HTMLSelectElement>('low').value),newHigh=Number($<HTMLSelectElement>('high').value);
  if(newHigh-newLow<12){$('settings-error').hidden=false;$('settings-error').textContent='音域は1オクターブ以上にしてください。';return;}
  low=newLow;high=newHigh;options={transpose:Number($<HTMLSelectElement>('transpose').value),clef:$<HTMLSelectElement>('clef').value as ScoreOptions['clef']};
  for(const part of ['solo','chords','bass','ride'] as const)player.mix[part]=$<HTMLInputElement>(`${part}-on`).checked?Number($<HTMLInputElement>(`${part}-volume`).value)/100:0;
  $('settings-error').hidden=true;$<HTMLDialogElement>('settings').close();redraw();status('設定を反映しました');
});
$('seed-generate').addEventListener('click',()=>{try{const n=Number($<HTMLInputElement>('seed-input').value);if(!Number.isInteger(n)||n<0||n>4294967295)throw new Error('シードは0〜4294967295の整数です。');newPhrase(n);$<HTMLDialogElement>('research').close();}catch(e){$<HTMLDialogElement>('research').close();error((e as Error).message);}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(player.playing||pending)){pending=false;player.stop('画面を離れたため停止しました');}});
window.addEventListener('pagehide',()=>player.stop());
let resize:ReturnType<typeof setTimeout>;new ResizeObserver(()=>{clearTimeout(resize);resize=setTimeout(()=>redraw(),80);}).observe($('score'));
type Tool={name:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean};execute:(input:any)=>unknown};
const toolRegistry=(document as Document&{modelContext?:{registerTool:(t:Tool,o:{signal:AbortSignal})=>Promise<void>|void}}).modelContext;
const lifecycle=new AbortController();
async function registerTools(){
  if(!toolRegistry?.registerTool)return;
  const tools:Tool[]=[{name:'read_bebop_phrase',description:'Read the current concert-pitch phrase and generation parameters.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({phrase,display:options,bpm:Number(bpmInput.value),playing:player.playing,key:currentKey,favoriteId:currentFavorite})},
    {name:'generate_bebop_phrase',description:'Generate and display a new phrase without starting audio.',inputSchema:{type:'object',properties:{chords:{type:'string'},bpm:{type:'integer',minimum:60,maximum:300},seed:{type:'integer',minimum:0,maximum:4294967295}},required:['chords'],additionalProperties:false},annotations:{readOnlyHint:false},execute:(v:unknown)=>{
      if(!v||typeof v!=='object')throw new Error('Expected an object');const a=v as Record<string,unknown>;
      if(Object.keys(a).some(k=>!['chords','bpm','seed'].includes(k))||typeof a.chords!=='string')throw new Error('Invalid arguments');
      parseProgression(a.chords);const bpm=a.bpm??Number(bpmInput.value);if(typeof bpm!=='number'||!Number.isInteger(bpm)||bpm<60||bpm>300)throw new Error('Invalid BPM');
      if(a.seed!==undefined&&(typeof a.seed!=='number'||!Number.isInteger(a.seed)||a.seed<0||a.seed>4294967295))throw new Error('Invalid seed');
      const result=generate(parseProgression(a.chords),bpm,low,high,(a.seed??crypto.getRandomValues(new Uint32Array(1))[0]) as number,model);
      input.value=a.chords;bpmInput.value=String(bpm);preset.value='custom';$('preset-note').textContent='手入力したコード進行です。';return newPhrase(result.seed);
    }}];
  for(const tool of tools)try{await toolRegistry.registerTool(tool,{signal:lifecycle.signal});}catch(e){console.warn('WebMCP unavailable',e);}
}
window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});

const keySelect=$<HTMLSelectElement>('key');KEY_NAMES.forEach((k,i)=>keySelect.add(new Option(k,String(i))));let currentKey=0;
let currentFavorite:string|null=null,saving=false;
function updateSave(){const b=$<HTMLButtonElement>('favorite-save');b.disabled=saving||play.disabled;b.textContent=saving?'保存中…':currentFavorite?'★ 保存済み':'☆ 保存';}
keySelect.addEventListener('change',()=>{
  const target=Number(keySelect.value);
  try{
    const parsed=parseProgression(input.value);
    const ready=!play.disabled&&parsed.text===(phrase.originalProgression??phrase.progression).text;
    const next=ready?transposePhrase(phrase,currentKey,target):null;
    const progression=(next?.originalProgression??next?.progression)??transposeProgression(parsed,target-currentKey,target);
    player.stop();input.value=progression.text;currentKey=target;
    if(next){phrase=next;low=next.low;high=next.high;$<HTMLSelectElement>('low').value=String(low);$<HTMLSelectElement>('high').value=String(high);redraw();currentFavorite=null;updateSave();status('進行・音列・音域を移調しました');}
    else status('移調した進行で「生成」');
    error('');
  }catch(e){keySelect.value=String(currentKey);error((e as Error).message);}
});
async function favoritesRequest(path='',init?:RequestInit){
  const r=await fetch('./api/favorites'+path,{...init,headers:{'Content-Type':'application/json',...init?.headers}});
  const result=await r.json().catch(()=>({error:'保存先に接続できませんでした。'}));
  if(!r.ok)throw new Error(result.error||'保存先に接続できませんでした。');return result;
}
$('favorite-save').addEventListener('click',async()=>{
  if(saving||play.disabled||currentFavorite)return;
  let bpm:number;try{bpm=readBpm();}catch(e){error((e as Error).message);return;}
  const saved:SavedPhrase={id:crypto.randomUUID(),name:`${KEY_NAMES[currentKey]} · ${phrase.progression.bars}小節 · #${phrase.seed}`,createdAt:Date.now(),key:currentKey,bpm,phrase:structuredClone(phrase)};
  const original=phrase;saving=true;updateSave();
  try{await favoritesRequest('/'+saved.id,{method:'PUT',body:JSON.stringify(saved)});if(phrase===original)currentFavorite=saved.id;status('お気に入りに保存しました');error('');}
  catch(e){error((e as Error).message);}finally{saving=false;updateSave();}
});
function loadFavorite(saved:SavedPhrase){
  const v=validateSaved(saved);sessionMode.value='normal';sessionChanged();player.stop();phrase=structuredClone(v.phrase);currentKey=v.key;keySelect.value=String(v.key);harmony.value=phrase.originalProgression?'adventure':'standard';input.value=(phrase.originalProgression??phrase.progression).text;bpmInput.value=String(v.bpm);low=phrase.low;high=phrase.high;
  $<HTMLSelectElement>('low').value=String(low);$<HTMLSelectElement>('high').value=String(high);preset.value='custom';$('key-mode').textContent='保存時のキー';$('preset-note').textContent='保存したフレーズです。';
  $('phrase-number').textContent=v.name;$('bar-count').textContent=`${phrase.progression.bars} bars`;$('seed-label').textContent=`#${phrase.seed}`;$('version').textContent=phrase.version;$<HTMLInputElement>('seed-input').value=String(phrase.seed);
  currentFavorite=v.id;play.disabled=false;updateSave();redraw();updateTiming();error('');status('お気に入りを読み込みました');$<HTMLDialogElement>('favorites').close();
}
let favoritesLoading=false;
async function showFavorites(){
  if(favoritesLoading)return;favoritesLoading=true;$('favorites-message').textContent='読み込み中…';$('favorites-list').replaceChildren();
  try{
    const items=(await favoritesRequest()) as SavedPhrase[];
    $('favorites-message').textContent=items.length?`${items.length}件 · 保存した音列をそのまま再生できます`:'まだ保存されていません。譜面の「☆ 保存」で追加できます。';
    for(const item of items){
      const row=document.createElement('article');row.className='favorite-row';
      const name=document.createElement('input');name.value=item.name;name.maxLength=80;name.setAttribute('aria-label','フレーズ名');
      const detail=document.createElement('p');detail.textContent=`${item.bpm} BPM · ${KEY_NAMES[item.key]} · ${new Date(item.createdAt).toLocaleDateString('ja-JP')}\n${item.phrase.progression.text}`;
      const actions=document.createElement('div');actions.className='favorite-actions';
      const open=document.createElement('button');open.textContent='開く';open.onclick=()=>{try{loadFavorite(item);}catch(e){$('favorites-message').textContent=(e as Error).message;}};
      const rename=document.createElement('button');rename.textContent='名前を保存';rename.onclick=async()=>{rename.disabled=true;try{const next={...item,name:name.value};validateSaved(next);await favoritesRequest('/'+item.id,{method:'PUT',body:JSON.stringify(next)});item.name=next.name;$('favorites-message').textContent='名前を保存しました';}catch(e){$('favorites-message').textContent=(e as Error).message;}finally{rename.disabled=false;}};
      const remove=document.createElement('button');remove.textContent='削除';remove.onclick=async()=>{remove.disabled=true;try{await favoritesRequest('/'+item.id,{method:'DELETE'});row.remove();if(currentFavorite===item.id){currentFavorite=null;updateSave();}const undo=document.createElement('button');undo.textContent='削除を取り消す';undo.onclick=async()=>{undo.disabled=true;try{await favoritesRequest('/'+item.id,{method:'PUT',body:JSON.stringify(item)});await showFavorites();}catch(e){$('favorites-message').textContent=(e as Error).message;undo.disabled=false;}};$('favorites-message').replaceChildren(document.createTextNode('削除しました。'),undo);}catch(e){$('favorites-message').textContent=(e as Error).message;remove.disabled=false;}};
      actions.append(open,rename,remove);row.append(name,detail,actions);$('favorites-list').append(row);
    }
  }catch(e){$('favorites-message').textContent=(e as Error).message;}finally{favoritesLoading=false;}
}
$('favorites-open').addEventListener('click',()=>{player.stop();$<HTMLDialogElement>('favorites').showModal();void showFavorites();});
$('favorites-retry').addEventListener('click',()=>void showFavorites());

gen.disabled=true;play.disabled=true;
async function init(){
  try{
    const response=await fetch('./research/model.json');if(!response.ok)throw new Error('分析モデルを読み込めませんでした。ページを再読み込みしてください。');
    model=await response.json();await document.fonts.ready;newPhrase(20261005);gen.disabled=false;await registerTools();
  }catch(e){error((e as Error).message);$('score').textContent='譜面を表示できませんでした。「生成」で別のフレーズをお試しください。';}
  finally{gen.disabled=!model;}
}
void init();
