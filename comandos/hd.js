const { writeFileSync, existsSync, unlinkSync } = require("fs");
const crypto = require("crypto");
const path = require("path");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const FormData = require("form-data");
const fetch = require("node-fetch");

const API_BASE="https://api.upscale.media";
const UPLOAD_PATH="/service/public/transformation/v1.0/predictions/sr/upscale";
const POLL_BASE="/service/public/transformation/v1.0/predictions/";
const UA="Mozilla/5.0";

let ANON_KEY=null;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const getJid=m=>m.key?.remoteJid||m.chat;

function genVisitorId(){
return Math.random().toString().slice(2,11);
}

async function extractKey(){
try{
const r=await fetch("https://www.upscale.media/");
const t=await r.text();
const m=t.match(/ANON_PREDICTION_SIGNATURE_KEY['":\s]*['"]([^'"]+)['"]/);
return m?m[1]:null;
}catch{return null;}
}

function sign(p,v){
const ts=new Date().toISOString();
if(!ANON_KEY) return{ts,sig:null};
const sig=crypto.createHmac("sha256",ANON_KEY)
.update(`POST${encodeURI(p)}${ts}${v}`)
.digest("hex");
return{ts,sig};
}

function getMime(name){
const e=path.extname(name).toLowerCase();
return{".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png",".webp":"image/webp"}[e]||"image/jpeg";
}

async function upload(buf,name,vid,scale){

console.log("📤 Subiendo imagen...");
const {ts,sig}=sign(UPLOAD_PATH,vid);

const fd=new FormData();
fd.append("input.image",buf,{filename:name,contentType:getMime(name)});
fd.append("input.type",scale);

const headers={
"User-Agent":UA,
"pixb-cl-id":vid,
"x-ebg-param":Buffer.from(ts).toString("base64"),
"Referer":"https://www.upscale.media/",
"Origin":"https://www.upscale.media",
...fd.getHeaders()
};

if(sig) headers["x-ebg-signature"]=sig;

const r=await fetch(API_BASE+UPLOAD_PATH,{method:"POST",headers,body:fd});
const j=await r.json().catch(()=>null);

console.log("UPLOAD RESPONSE:",j);
return j;
}

async function poll(id){

console.log("⏳ Esperando resultado...");

for(let i=0;i<40;i++){
await delay(3000);

console.log(`🔄 Poll ${i+1}`);

const r=await fetch(API_BASE+POLL_BASE+id);
if(r.status!==200) continue;

const d=await r.json();
const s=d.status?.toUpperCase();

console.log("STATUS:",s);

if(s==="COMPLETED"||s==="SUCCESS") return d;
if(s==="FAILED"||s==="ERROR") return null;
}
return null;
}

module.exports={
name:"hd",
alias:["upscale","mejorar"],

async execute(sock,m,args){

let input=null;

try{

const jid=getJid(m);
if(!jid) return;

const scaleArg=(args?.[0]||"").toUpperCase();
const scale = ["2X","4X","8X"].includes(scaleArg)?scaleArg:"8X";

console.log("🔧 Escala:",scale);

const ctx=m.message?.extendedTextMessage?.contextInfo;
const quoted=ctx?.quotedMessage;

if(!quoted?.imageMessage){
return sock.sendMessage(jid,{text:"❌ Responde a una imagen\nEjemplo: hd 4x"},{quoted:m});
}

await sock.sendMessage(jid,{text:`📥 Descargando imagen...`},{quoted:m});

const buf=await downloadMediaMessage({
key:{
remoteJid:jid,
id:ctx.stanzaId,
participant:ctx.participant
},
message:quoted
},"buffer",{},{
reuploadRequest:sock.updateMediaMessage
});

console.log("✅ Descargada:",buf.length,"bytes");

input=`./tmp_${Date.now()}.jpg`;
writeFileSync(input,buf);

await sock.sendMessage(jid,{text:`🧠 Preparando mejora ${scale}...`},{quoted:m});

ANON_KEY=await extractKey();

const vid=genVisitorId();
const res=await upload(buf,path.basename(input),vid,scale);

if(!res?._id){
return sock.sendMessage(jid,{text:"❌ Error al subir imagen"},{quoted:m});
}

await sock.sendMessage(jid,{text:"✨ Mejorando calidad..."},{quoted:m});

const done=await poll(res._id);

if(!done?.output?.[0]){
return sock.sendMessage(jid,{text:"❌ Falló la mejora"},{quoted:m});
}

await sock.sendMessage(jid,{
image:{url:done.output[0]},
caption:`✨ Listo en ${scale}`
},{quoted:m});

console.log("🎉 Proceso completado");

}catch(e){
console.log("❌ ERROR:",e);
sock.sendMessage(getJid(m),{text:"❌ Error en proceso"},{quoted:m});
}
finally{
if(input&&existsSync(input)) unlinkSync(input);
}
}
};
