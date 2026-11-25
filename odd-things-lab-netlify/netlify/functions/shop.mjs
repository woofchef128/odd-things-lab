import pg from 'pg';
import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import Lab from '../../server/model.cjs';
let pool;
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export default async function handler(request,context){
 const {DATABASE_URL,ADMIN_PASSWORD,ADMIN_EMAILS,SESSION_SECRET}=process.env;
 if(!DATABASE_URL||!ADMIN_PASSWORD||!ADMIN_EMAILS||!SESSION_SECRET)return json({error:'店铺尚未连接数据库或配置店长登录。'},503);
 const sign=v=>createHmac('sha256',SESSION_SECRET).update(v).digest('hex');
 const equal=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)};
 const cookies=context.cookies, opts={httpOnly:true,secure:true,sameSite:'Strict',path:'/'};
 let visitor=cookies.get('mlv')||'';const [vid,sig]=visitor.split('.');
 if(!vid||!equal(sign('v'+vid),sig||'')){const id=randomUUID();visitor=id+'.'+sign('v'+id);cookies.set({name:'mlv',value:visitor,maxAge:31536000,...opts})}
 const key=sign(visitor),[expires,mac]=(cookies.get('mla')||'').split('.');const admin=Number(expires)>Date.now()&&equal(sign('a'+expires+key),mac||'');
 if(!['GET','POST'].includes(request.method))return json({error:'请求无效'},405);
 let p={};if(request.method==='POST'){if(request.headers.get('origin')!==new URL(request.url).origin||!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'请求来源无效'},403);const raw=await request.text();if(raw.length>1200000)return json({error:'图片太大'},413);try{p=JSON.parse(raw)}catch{return json({error:'数据无效'},400)}}
 pool??=new pg.Pool({connectionString:DATABASE_URL,max:2,connectionTimeoutMillis:5000});let c,begun=false;
 try{
  c=await pool.connect();
  await c.query('CREATE TABLE IF NOT EXISTS magua_store(id int PRIMARY KEY, data jsonb NOT NULL)');
  await c.query('INSERT INTO magua_store VALUES(1,$1) ON CONFLICT DO NOTHING',[Lab.initial()]);
  if(request.method==='POST'&&['login','join','search','parcel','wish','comment','certificate','message'].includes(p.op)){
   await c.query('CREATE TABLE IF NOT EXISTS magua_limit(k text PRIMARY KEY, n int NOT NULL, expires timestamptz NOT NULL)');
   await c.query('DELETE FROM magua_limit WHERE expires<now()');
   const k=sign((context.ip||'unknown')+':'+p.op+':'+Math.floor(Date.now()/600000));
   const t=await c.query("INSERT INTO magua_limit VALUES($1,1,now()+interval '11 minutes') ON CONFLICT(k) DO UPDATE SET n=magua_limit.n+1 RETURNING n",[k]);if(t.rows[0].n>35)return json({error:'尝试过多，请稍后再试'},429);
  }
  if(p.op==='login'){const email=String(p.email||'').trim().toLowerCase();const allowed=ADMIN_EMAILS.split(',').map(x=>x.trim().toLowerCase()).filter(x=>/^[^@\s]+@gmail\.com$/.test(x));if(!allowed.includes(email)||!equal(sign(String(p.password)),sign(ADMIN_PASSWORD)))return json({error:'Gmail 或研究所密码不正确'},403);const t=String(Date.now()+8*3600000);cookies.set({name:'mla',value:t+'.'+sign('a'+t+key),maxAge:28800,...opts});return json({ok:true})}
  if(p.op==='logout'){cookies.set({name:'mla',value:'',maxAge:0,...opts});return json({ok:true})}
  await c.query('BEGIN');begun=true;
  const row=await c.query('SELECT data FROM magua_store WHERE id=1'+(request.method==='POST'?' FOR UPDATE':''));const state=row.rows[0].data;let result={};
  if(request.method==='POST'){try{result=Lab.apply(state,p.op,p,admin,key)}catch(e){await c.query('ROLLBACK');begun=false;return json({error:e.message},400)}if(p.op!=='parcel')await c.query('UPDATE magua_store SET data=$1 WHERE id=1',[state])}
  await c.query('COMMIT');begun=false;return json({state:Lab.project(state,admin,key),admin,result});
 }catch{if(begun&&c)await c.query('ROLLBACK');return json({error:'店铺资料暂时无法读取，请稍后刷新。'},503)}finally{c?.release()}
}
export const config={path:'/api/shop'};
