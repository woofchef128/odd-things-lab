import { randomBytes, timingSafeEqual } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import catalog from '../../public/catalog.json' with {type:'json'};
const codePattern = /^ZT-[A-F0-9]{12}$/;
const keyPattern = /^[A-F0-9]{32}$/;
const reply = (data, status = 200) => Response.json(data, {status, headers:{'Cache-Control':'no-store'}});
const fail = (error,status) => reply({error},status);
function safeEqual(left,right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a,b);
}
function view(order) {
  const {code, lines, dog, stage, updatedAt, demo, shipping, paymentMethod, note} = order;
  return {code, lines, dog, stage, updatedAt, demo, shipping, paymentMethod, note};
}
export default async request => {
  const url = new URL(request.url);
  const store = getStore({name:'zentio-orders', consistency:'strong'});
  const code = url.searchParams.get('order') || '';
  const secret = process.env.ZENTIO_ADMIN_KEY;
  const isAdmin = secret && safeEqual(request.headers.get('Authorization'), 'Bearer ' + secret);
  if (request.method === 'GET') {
    if (isAdmin && codePattern.test(code)) {
      const order = await store.get(code,{type:'json'});
      return order ? reply({...view(order), note:order.note}) : fail('找不到该订单。',404);
    }
    const key = url.searchParams.get('key') || '';
    if (!codePattern.test(code) || !keyPattern.test(key)) return fail('请输入有效的订单号和查询码。',400);
    const order = await store.get(code,{type:'json'});
    if (!order || !safeEqual(order.key,key)) return fail('订单号或查询码有误。',404);
    return reply(view(order));
  }
  if (!['POST','PATCH'].includes(request.method)) return fail('请求方式不支持。',405);
  const raw = await request.text();
  if (raw.length > 8000) return fail('订单内容太长。',413);
  let data;
  try {data = JSON.parse(raw);} catch {return fail('订单格式有误。',400);}
  if (!data || typeof data !== 'object') return fail('订单格式有误。',400);
  if (request.method === 'PATCH') {
    if (!isAdmin) return fail('后台密码有误。',401);
    if (!codePattern.test(code) || !Number.isInteger(data.stage) || !catalog.stages[data.stage]) return fail('订单号或状态有误。',400);
    const current = await store.getWithMetadata(code,{type:'json'});
    if (!current) return fail('找不到该订单。',404);
    const order = {...current.data, stage:data.stage, updatedAt:new Date().toISOString()};
    const result = await store.setJSON(code,order,{onlyIfMatch:current.etag});
    return result.modified ? reply(view(order)) : fail('订单刚刚被更新，请重试。',409);
  }
  const {items,dog,note,shipping,paymentMethod} = data;
  const shippingLimits = {name:100,phone:30,address:300,postcode:16,city:100,state:100};
  if (!shipping || Object.entries(shippingLimits).some(([field,max]) =>
    typeof shipping[field] !== 'string' || !shipping[field].trim() || shipping[field].length > max
  ) || !/^[+0-9() -]{7,30}$/.test(shipping.phone.trim()) ||
    !['qr','bank'].includes(paymentMethod)) {
    return fail('请检查收件资料及付款方式。',400);
  }
  if (!Array.isArray(items) || items.length === 0 || items.length > catalog.products.length ||
      typeof note !== 'string' || note.length > 600 ||
      !dog || !['cream','brown','gray'].includes(dog.color) ||
      !['floppy','pointy'].includes(dog.ears) || !['none','bow','star'].includes(dog.extra)) {
    return fail('请选择商品，并检查小狗设置和备注。',400);
  }
  const lines = [];
  const seen = new Set();
  for (const item of items) {
    const product = catalog.products.find(candidate => candidate.id === item?.id);
    if (!product || seen.has(item.id) || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 20) {
      return fail('商品或数量有误。',400);
    }
    seen.add(item.id);
    lines.push({name:product.name,cents:product.cents,qty:item.qty});
  }
  const order = {
    code:'ZT-' + randomBytes(6).toString('hex').toUpperCase(),
    key:randomBytes(16).toString('hex').toUpperCase(), lines,
    dog:{color:dog.color,ears:dog.ears,extra:dog.extra}, note:note.trim(),
    shipping:Object.fromEntries(Object.keys(shippingLimits).map(field => [field,shipping[field].trim()])),
    paymentMethod,
    stage:0, updatedAt:new Date().toISOString(), demo:!catalog.live
  };
  const result = await store.setJSON(order.code,order,{onlyIfNew:true});
  return result.modified ? reply({...view(order), key:order.key},201) : fail('订单号重复，请重试。',409);
};
