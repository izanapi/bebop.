import {favoritesApi,type Database} from './favorites-api.ts';
// Generated asset map is bundled during build; no runtime filesystem is used.
// @ts-ignore generated virtual module
import assets from 'bebop:assets';
export default {async fetch(request:Request,env:{DB?:Database}){
  const path=new URL(request.url).pathname;
  if(path.startsWith('/api/'))return favoritesApi(request,env.DB);
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
  const entry=assets[path.endsWith('/')?path+'index.html':path];
  if(!entry)return new Response('Not found',{status:404});
  const body=Uint8Array.from(atob(entry.data),(c:string)=>c.charCodeAt(0));
  return new Response(request.method==='HEAD'?null:body,{headers:{'Content-Type':entry.type,'Cache-Control':path.endsWith('.wav')?'public, max-age=86400':'no-cache','X-Content-Type-Options':'nosniff'}});
}};
