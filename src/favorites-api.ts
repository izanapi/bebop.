import {validateSaved} from './practice.ts';
export interface Statement{bind(...args:unknown[]):Statement;all():Promise<{results:Record<string,unknown>[]}>;run():Promise<unknown>}
export interface Database{prepare(sql:string):Statement}
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function favoritesApi(request:Request,db:Database|undefined){
  const url=new URL(request.url),owner=request.headers.get('oai-authenticated-user-id');
  if(!owner)return json({error:'お気に入りを使うには、サイトにサインインしてください。'},401);
  if(!db)return json({error:'保存先に接続できません。時間をおいてお試しください。'},503);
  if(request.method!=='GET'&&request.headers.get('Origin')!==url.origin)return json({error:'このサイトから操作してください。'},403);
  const match=/^\/api\/favorites(?:\/([a-zA-Z0-9-]{1,80}))?$/.exec(url.pathname);
  if(!match)return json({error:'見つかりません。'},404);const id=match[1];
  try{
    if(request.method==='GET'&&!id){const r=await db.prepare('SELECT payload FROM favorites WHERE owner = ? AND deleted = 0 ORDER BY created_at DESC').bind(owner).all();return json(r.results.map(row=>JSON.parse(String(row.payload))));}
    if(request.method==='PUT'&&id){
      if(Number(request.headers.get('content-length'))>100000)return json({error:'保存データが大きすぎます。'},413);
      const body=await request.text();if(body.length>100000)return json({error:'保存データが大きすぎます。'},413);
      let value;try{value=validateSaved(JSON.parse(body));if(value.id!==id)throw new Error('保存先が一致しません。');}catch(e){return json({error:(e as Error).message},400);}
      await db.prepare('INSERT INTO favorites (owner, id, payload, created_at, deleted) VALUES (?, ?, ?, ?, 0) ON CONFLICT(owner, id) DO UPDATE SET payload = excluded.payload, deleted = 0').bind(owner,id,JSON.stringify(value),value.createdAt).run();return json({ok:true});
    }
    if(request.method==='DELETE'&&id){await db.prepare('UPDATE favorites SET deleted = 1 WHERE owner = ? AND id = ?').bind(owner,id).run();return json({ok:true});}
    return json({error:'未対応の操作です。'},405);
  }catch(e){console.error('Favorites storage failed',e);return json({error:'保存先に接続できませんでした。入力は残っています。もう一度お試しください。'},503);}
}
