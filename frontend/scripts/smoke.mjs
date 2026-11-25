import assert from 'node:assert/strict';
import WebSocket from 'ws';
const base=process.env.ZENTEA_API || 'http://localhost:8000';
const sockets=[];
async function call(path,{token,method='GET',body,headers={}}={}) {
 const response=await fetch(base+path,{method,headers:{Accept:'application/json','Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...headers},body:body?JSON.stringify(body):undefined});
 const text=await response.text();
 let data;try{data=JSON.parse(text);}catch{data=text;}
 assert.ok(response.ok,method+' '+path+' returned '+response.status+' '+JSON.stringify(data).slice(0,400));
 return {data,response};
}
async function subscribe(channel,token){
 const ws=new WebSocket('ws://localhost:8080/app/zentea-key?protocol=7&client=js&version=8.4.0',{origin:'http://localhost:5173'});
 sockets.push(ws);const events=[];
 ws.on('message',raw=>{const event=JSON.parse(raw.toString());if(typeof event.data==='string')event.data=JSON.parse(event.data);events.push(event);});
 async function waitFor(predicate){
  const deadline=Date.now()+20000;
  while(Date.now()<deadline){const event=events.find(predicate);if(event)return event;await new Promise(resolve=>setTimeout(resolve,100));}
  throw new Error('Timed out on '+channel+' '+JSON.stringify(events));
 }
 const connected=await waitFor(e=>e.event==='pusher:connection_established');
 const auth=channel.startsWith('private-')?(await call('/broadcasting/auth',{method:'POST',token,body:{socket_id:connected.data.socket_id,channel_name:channel}})).data.auth:undefined;
 ws.send(JSON.stringify({event:'pusher:subscribe',data:{channel,auth}}));
 await waitFor(e=>e.event==='pusher_internal:subscription_succeeded');
 return {waitFor,events};
}
try {
 const customer=(await call('/api/auth/login',{method:'POST',body:{email:'khach@zentea.local',password:'Zentea@123'}})).data;
 const admin=(await call('/api/auth/login',{method:'POST',body:{email:'admin@zentea.local',password:'Zentea@123'}})).data;
 const adminEvents=await subscribe('private-admin.orders',admin.token);
 const userEvents=await subscribe('private-user.'+customer.user.id,customer.token);
 const products=(await call('/api/products')).data.data;
 const variant=products[0].variants[0];
 const body={idempotency_key:crypto.randomUUID(),recipient:'Khách kiểm thử',phone:'0901234567',address:'123 Nguyễn Huệ, TP. Hồ Chí Minh',payment_method:'momo',items:[{variant_id:variant.id,quantity:1}]};
 const order=(await call('/api/orders',{method:'POST',token:customer.token,body})).data;
 assert.equal(order.total,variant.price);assert.equal(order.status,'pending');
 const repeat=(await call('/api/orders',{method:'POST',token:customer.token,body})).data;assert.equal(order.id,repeat.id);
 await adminEvents.waitFor(e=>e.event==='NewOrderPlaced'&&e.data.order.id===order.id);
 await userEvents.waitFor(e=>e.event==='NewOrderPlaced'&&e.data.order.id===order.id);
 await call('/api/orders/'+order.id+'/mock-payment',{method:'POST',token:customer.token,body:{result:'success'}});
 for(const status of ['preparing','delivering','completed']) {
  await call('/api/admin/orders/'+order.id+'/status',{method:'PATCH',token:admin.token,body:{status}});
  await userEvents.waitFor(e=>e.event==='OrderStatusUpdated'&&e.data.order.id===order.id&&e.data.order.status===status);
 }
 const denied=await fetch(base+'/api/admin/orders',{headers:{Accept:'application/json',Authorization:'Bearer '+customer.token}});assert.equal(denied.status,403);
 const csv=await fetch(base+'/api/admin/reports?period=month&format=csv',{headers:{Authorization:'Bearer '+admin.token}});assert.equal(csv.status,200);assert.match(await csv.text(),/Doanh thu/);
 const pdf=await fetch(base+'/api/admin/reports?period=month&format=pdf',{headers:{Authorization:'Bearer '+admin.token}});assert.equal(pdf.status,200);assert.ok((await pdf.text()).startsWith('%PDF'));
 console.log('PASS PostgreSQL checkout, idempotency, mock payment, admin permissions, CSV/PDF and private WebSocket events. Demo order #'+order.code);
} finally {for(const ws of sockets)ws.close();}
