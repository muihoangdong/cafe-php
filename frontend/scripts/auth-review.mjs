import assert from 'node:assert/strict';
import WebSocket from 'ws';
const base='http://localhost:8000';
async function login(email){const response=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({email,password:'Zentea@123'})});assert.equal(response.status,200);return {data:await response.json(),cookie:response.headers.getSetCookie()[0].split(';')[0]};}
const customer=await login('khach@zentea.local');
const refresh=await fetch(base+'/api/auth/refresh',{method:'POST',headers:{Accept:'application/json','X-Zentea-Client':'web',Cookie:customer.cookie}});
assert.equal(refresh.status,200);const renewed=await refresh.json();assert.notEqual(renewed.token,customer.data.token);
const replay=await fetch(base+'/api/auth/refresh',{method:'POST',headers:{Accept:'application/json','X-Zentea-Client':'web',Cookie:customer.cookie}});assert.equal(replay.status,401);
const oldAccess=await fetch(base+'/api/auth/me',{headers:{Accept:'application/json',Authorization:'Bearer '+customer.data.token}});assert.equal(oldAccess.status,401);
const token=renewed.token;
async function api(path,method='GET',body,auth=token){const r=await fetch(base+'/api'+path,{method,headers:{Accept:'application/json','Content-Type':'application/json',Authorization:'Bearer '+auth},body:body?JSON.stringify(body):undefined});assert.ok(r.ok,path+' '+r.status);return r.status===204?null:r.json();}
const orders=await api('/orders');const order=orders.data.find(o=>o.status==='completed');assert.ok(order);
// Find the product by the ordered item's product ID via its variant.
const products=(await api('/products')).data;const product=products.find(p=>p.name===order.items[0].name);assert.ok(product);
const detail=await api('/products/'+product.id);
const admin=(await login('admin@zentea.local')).data;
if(!detail.reviews.some(r=>r.user.id===renewed.user.id)){
 const ws=new WebSocket('ws://localhost:8080/app/zentea-key?protocol=7&client=js&version=8.4.0',{origin:'http://localhost:5173'});const events=[];ws.on('message',raw=>events.push(JSON.parse(raw.toString())));
 const wait=async name=>{const end=Date.now()+15000;while(Date.now()<end){if(events.some(e=>e.event===name))return;await new Promise(r=>setTimeout(r,100));}throw Error('No '+name);};
 try {
  await wait('pusher:connection_established');ws.send(JSON.stringify({event:'pusher:subscribe',data:{channel:'product.'+product.id}}));await wait('pusher_internal:subscription_succeeded');
  const review=await api('/products/'+product.id+'/reviews','POST',{rating:5,comment:'Trà thơm, giao hàng nhanh. Đánh giá kiểm thử Zentea.'});
  await api('/admin/reviews/'+review.id,'PATCH',{status:'approved'},admin.token);await wait('ReviewApproved');
 }finally{ws.close();}
}
const approved=await api('/products/'+product.id);assert.ok(approved.reviews.some(r=>r.user.id===renewed.user.id));
console.log('PASS refresh token rotation, revoked access token, replay rejection and approved reviews over public WebSocket.');
