const fs=require('fs'),path=require('path'),axios=require('axios');
const libDir=path.join(__dirname,"../lib"),binsPath=path.join(libDir,"bins.json");
async function getInfo(bin){if(!bin||bin.length<6)return{c:"Desconocido",b:"Genérico"};
try{const{data}=await axios.get(`https://lookup.binlist.net/${bin.substring(0,6)}`,{timeout:2000});
return{c:data.country?data.country.name:"Desconocido",b:data.bank?data.bank.name:"Genérico"};
}catch{return{c:"Desconocido",b:"Genérico"};}}
function luhn(cc){let s=0,db=false;for(let i=cc.length-1;i>=0;i--){let d=parseInt(cc[i],10);
if(db){d*=2;if(d>9)d-=9;}s+=d;db=!db;}return s%10===0;}
function gen(p){let cl=p.replace(/\D/g,''),ln=(cl.startsWith('34')||cl.startsWith('37'))?15:16;
while(cl.length<ln)cl+='x';for(let i=0;i<2000;i++){let s='';for(let j=0;j<ln-1;j++)s+=(cl[j].toLowerCase()==='x')?Math.floor(Math.random()*10):cl[j];
let sm=0,a=true;for(let j=s.length-1;j>=0;j--){let d=parseInt(s[j],10);if(a){d*=2;if(d>9)d-=9;}sm+=d;a=!a;}
let f=s+((sm*9)%10);if(luhn(f))return f;}return null;}
module.exports={name:"bin",alias:["gen","chk"],async execute(client,msg,args){
const jid=msg.key.remoteJid,q=msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
if(q){const txt=q.conversation||q.extendedTextMessage?.text||"";
const cards=txt.match(/\d{10,16}\|\d{2}\|\d{2,4}\|\d{3,4}/gi);if(!cards)return;
let rep=`⚖️ *CHECKER REAL-TIME*\n\n`;for(const card of cards){
const cc=card.split('|')[0],isL=luhn(cc),inf=await getInfo(cc);
rep+=`${isL?"✅ *LIVE*":"💀 *DEAD*"} ➜ \`${card}\`\n🌍 ${inf.c} | 🏛️ ${inf.b}\n\n`;
await new Promise(r=>setTimeout(r,500));}return client.sendMessage(jid,{text:rep+"🐺 *Husky-Bot*"},{quoted:msg});}
if(args.length>0){let qty=10;if(args.length>1&&!isNaN(args[args.length-1]))qty=Math.min(parseInt(args.pop()),15);
let b=args[0],m="rnd",y="rnd",cv="rnd";if(b.includes('|'))[b,m,y,cv]=b.split('|');
const inf=await getInfo(b.replace(/\D/g,''));let res=`✨ *BINNER GEN*\n🌍 ${inf.c} | 🏛️ ${inf.b}\n\n`;
for(let i=0;i<qty;i++){const c=gen(b);if(!c)continue;
const fM=(m==="rnd"||m==="xxx")?(Math.floor(Math.random()*12)+1).toString().padStart(2,'0'):m;
const fY=(y==="rnd"||y==="xxx")?(new Date().getFullYear()+Math.floor(Math.random()*8)+1).toString():y;
const fV=(cv==="rnd"||cv==="xxx")?(c.startsWith('3')?Math.floor(Math.random()*8999+1000):Math.floor(Math.random()*899+100)):cv;
res+=`• \`${c}|${fM}|${fY}|${fV}\`\n`;}return client.sendMessage(jid,{text:res+"\n✅ *Luhn Algorithm OK*"},{quoted:msg});}
return client.sendMessage(jid,{text:"❌ `!bin BIN|MM|YY|CVV QTY`"});}};

