const {test}=require('node:test');
const assert=require('node:assert/strict');
const Lab=require('./model.cjs');
const email=require('./order-email.cjs');
const image='data:image/png;base64,aGVsbG8=';
const payload=(extra={})=>({checkoutVersion:2,token:crypto.randomUUID(),buyer:'Customer One',phone:'0123456789',email:'customer@example.com',sameRecipient:true,address:'123 Test Street',postcode:'50000',city:'Kuala Lumpur',state:'W.P. Kuala Lumpur',region:'west',fulfillment:'delivery',payer:'Customer One',dog:5,items:[{id:'p0',variant:0,qty:1}],total:3700,...extra});
const place=(s,p)=>{const result=Lab.apply(s,'order',p,false,'visitor');return s.orders.find(o=>o.id===result.order)};
test('legacy shipping settings migrate without overwriting configured fees',()=>{
 const s=Lab.initial(true);s.shipping=[800,2000];Lab.migrate(s);assert.deepEqual(s.shipping,[800,2000,null]);Lab.migrate(s);assert.deepEqual(s.shipping,[800,2000,null]);
});
test('delivery verifies region against state and uses server shipping fee',()=>{
 const s=Lab.initial(true);assert.throws(()=>place(s,payload({region:'east'})),/不一致/);
 assert.throws(()=>place(s,payload({total:2900})),/金额/);
 const o=place(s,payload());assert.equal(o.fee,800);assert.equal(o.recipientName,o.buyer);assert.equal(o.recipientPhone,o.phone);
});
test('pickup needs no postal address and preserves an independent recipient',()=>{
 const s=Lab.initial(true);s.pickup={address:'Studio address',instructions:'Appointment only'};
 const o=place(s,payload({fulfillment:'pickup',address:undefined,city:undefined,state:undefined,postcode:undefined,region:undefined,total:2900,sameRecipient:false,recipientName:'Recipient Two',recipientPhone:'+65 8123 4567'}));
 assert.equal(o.fee,0);assert.equal(o.address,'');assert.equal(o.recipientName,'Recipient Two');assert.equal(o.recipientPhone,'6581234567');assert.equal(o.pickupInfo.address,'Studio address');
});
test('Singapore delivery requires configured fee and a six-digit postcode',()=>{
 const s=Lab.initial(true),p=payload({region:'singapore',state:'Singapore',city:'Singapore',postcode:'018956',phone:'+65 8123 4567',total:7400});
 assert.throws(()=>place(s,p),/运费/);s.shipping[2]=4500;
 assert.throws(()=>place(s,{...p,postcode:'50000'}),/六位/);
 const o=place(s,p);assert.equal(o.region,'singapore');assert.equal(o.fee,4500);
});
test('new checkout rejects missing email and invalid recipient phone',()=>{
 const s=Lab.initial(true);assert.throws(()=>place(s,payload({email:''})));assert.throws(()=>place(s,payload({sameRecipient:false,recipientPhone:'ABC'})),/电话号码/);
});
test('custom photos and required text are validated; separate customizations share inventory',()=>{
 const s=Lab.initial(true);Object.assign(s.products[0],{allowPhoto:true,requirePhoto:true,customFields:[{label:'Name',required:true}]});
 assert.throws(()=>place(s,payload()),/照片/);
 assert.throws(()=>place(s,payload({items:[{id:'p0',qty:1,customization:{photo:image,fields:[]}}]})));
 const one={id:'p0',qty:1,variant:0,line:'one',customization:{photo:image,fields:[{label:'Name',value:'One'}],remark:'blue'}},two={...one,line:'two',customization:{...one.customization,fields:[{label:'Name',value:'Two'}]}};
 const o=place(s,payload({items:[one,two],total:6600}));
 assert.equal(s.products[0].stock,10);assert.equal(o.items[0].customization.fields[0].value,'One');assert.equal(o.items[1].customization.fields[0].value,'Two');
 const publicOrder=Lab.project(s,false,'outsider').orders.find(x=>x.id===o.id);assert.equal(publicOrder.items[0].customization,undefined);assert.equal(publicOrder.email,undefined);assert.equal(publicOrder.recipientPhone,undefined);
});
test('admin saves all three shipping fees, pickup information and photo configuration',()=>{
 const s=Lab.initial(true);Lab.apply(s,'settings',{west:1000,east:2100,singapore:4500,pickupAddress:'Studio',pickupInstructions:'Appointment',qr:''},true,'owner');
 assert.deepEqual(s.shipping,[1000,2100,4500]);assert.equal(s.pickup.address,'Studio');
 const product={...s.products[0],allowPhoto:true,requirePhoto:true,customFields:[{label:'Custom name',required:true}]};
 Lab.apply(s,'product',product,true,'owner');assert.equal(s.products[0].requirePhoto,true);assert.equal(s.products[0].customFields[0].required,true);
});
test('order email includes distinct customer, recipient, fulfillment and inline custom reference',()=>{
 const s=Lab.initial(true);Object.assign(s.products[0],{allowPhoto:true,photo:image});
 const o=place(s,payload({sameRecipient:false,recipientName:'Recipient <Two>',recipientPhone:'0129998888',items:[{id:'p0',qty:1,customization:{photo:image,remark:'<script>alert(1)</script>'}}]}));
 const mail=email(o,'https://magualab.netlify.app');assert.ok(mail.html.includes('Recipient &lt;Two&gt;'));assert.ok(mail.text.includes('customer@example.com'));assert.ok(mail.html.includes('West Malaysia'));assert.ok(mail.html.includes('定制参考照片'));assert.ok(!mail.html.includes('<script>'));assert.equal(mail.attachments.length,1);
 const pickupMail=email({...o,fulfillment:'pickup',pickupInfo:{address:'Studio',instructions:'Appointment'}});assert.ok(pickupMail.text.includes('自取地点：Studio'));
});
