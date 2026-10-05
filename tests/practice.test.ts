import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {DatabaseSync} from 'node:sqlite';
import {generate,parseProgression,pc,PRESETS} from '../src/music.ts';import {transposePhrase,transposeProgression,validateSaved,type SavedPhrase} from '../src/practice.ts';import {favoritesApi,type Database} from '../src/favorites-api.ts';
const model=JSON.parse(readFileSync(new URL('../public/research/model.json',import.meta.url),'utf8'));
const phrase=generate(parseProgression(PRESETS[5].text),140,60,84,14,model);
const saved:SavedPhrase={id:'test-phrase',name:'練習',createdAt:1234,key:10,bpm:140,phrase};
test('all 12 keys preserve melody intervals, rhythm, slash bass and harmonic relationship',()=>{
 for(let key=0;key<12;key++){
  const p=transposePhrase(phrase,10,key);assert.equal(p.notes.length,phrase.notes.length);
  p.notes.forEach((n,i)=>{const old=phrase.notes[i];assert.equal(n.start,old.start);assert.equal(n.duration,old.duration);if(n.pitch!==null){assert.equal(pc(n.pitch-old.pitch!),pc(key-10));assert.ok(n.pitch>=p.low&&n.pitch<=p.high);}});
  p.progression.changes.forEach((c,i)=>assert.equal(pc(c.chord.root-phrase.progression.changes[i].chord.root),pc(key-10)));
 }
 const p=transposeProgression(parseProgression('Cmaj7/E G7/B | C6/9 |'),2,2);assert.equal(p.text,'Dmaj7/F# A7/C# | D6/9 |');
 assert.deepEqual(transposePhrase(transposePhrase(phrase,10,0),0,10),phrase);
});
test('saved notes are retained exactly; corrupted notes and incomplete measures are rejected',()=>{
 assert.deepEqual(validateSaved(JSON.parse(JSON.stringify(saved))).phrase,phrase);
 assert.throws(()=>validateSaved({...saved,phrase:{...phrase,notes:phrase.notes.slice(1)}}));
 assert.throws(()=>validateSaved({...saved,phrase:{...phrase,notes:[{...phrase.notes[0],pitch:127},...phrase.notes.slice(1)]}}));
});
test('favorites persist with per-user isolation, rename, recoverable delete and failure handling',async()=>{
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('CREATE TABLE favorites (owner TEXT, id TEXT, payload TEXT, created_at INTEGER, deleted INTEGER DEFAULT 0, PRIMARY KEY(owner,id))');
 const db:Database={prepare(sql){let args:unknown[]=[];return {bind(...a){args=a;return this;},async all(){return {results:sqlite.prepare(sql).all(...args as any[])};},async run(){return sqlite.prepare(sql).run(...args as any[]);}};}};
 const req=(method:string,id='',value?:unknown,owner='alice',origin='https://practice.test')=>new Request('https://practice.test/api/favorites'+id,{method,headers:{'oai-authenticated-user-id':owner,Origin:origin},...(value?{body:JSON.stringify(value)}:{})});
 assert.equal((await favoritesApi(req('PUT','/test-phrase',saved),db)).status,200);
 assert.deepEqual(await (await favoritesApi(req('GET'),db)).json(),[saved]);
 assert.deepEqual(await (await favoritesApi(req('GET','',undefined,'bob'),db)).json(),[]);
 await favoritesApi(req('DELETE','/test-phrase',undefined,'bob'),db);
 assert.equal((await (await favoritesApi(req('GET'),db)).json()).length,1);
 await favoritesApi(req('PUT','/test-phrase',{...saved,name:'名前変更'}),db);
 assert.equal((await (await favoritesApi(req('GET'),db)).json())[0].name,'名前変更');
 await favoritesApi(req('DELETE','/test-phrase'),db);assert.deepEqual(await (await favoritesApi(req('GET'),db)).json(),[]);
 await favoritesApi(req('PUT','/test-phrase',saved),db);assert.deepEqual(await (await favoritesApi(req('GET'),db)).json(),[saved]);
 assert.equal((await favoritesApi(req('PUT','/test-phrase',saved,'alice','https://other.test'),db)).status,403);
 assert.equal((await favoritesApi(req('GET','',undefined,''),db)).status,401);
 assert.equal((await favoritesApi(req('PUT','/test-phrase',{...saved,key:99}),db)).status,400);
 assert.equal((await favoritesApi(req('GET'),undefined)).status,503);sqlite.close();
});
