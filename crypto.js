/* Fernet v0x80: AES-128-CBC + HMAC-SHA256. No third-party dependencies. */
(() => {
  'use strict';
  const enc = new TextEncoder();
  const dec = new TextDecoder('utf-8', {fatal:true});
  const bytes = value => value instanceof Uint8Array ? value : new Uint8Array(value);
  const concat = (...parts) => {
    const out = new Uint8Array(parts.reduce((n,p)=>n+p.length,0));
    let at=0; for (const part of parts) {out.set(part,at);at+=part.length;} return out;
  };
  function b64(data,url=false) {
    data=bytes(data); let text='';
    for(let i=0;i<data.length;i+=16384) text+=String.fromCharCode(...data.subarray(i,i+16384));
    const result=btoa(text); return url?result.replace(/\+/g,'-').replace(/\//g,'_'):result;
  }
  function unb64(value,url=false) {
    let text=value.trim().replace(/\s/g,'');
    if(!text || !(url?/^[A-Za-z0-9_-]+={0,2}$/:/^[A-Za-z0-9+/]+={0,2}$/).test(text) || text.length%4===1) throw Error('Base64 格式不正確，請使用原有字元修改。');
    if(url) text=text.replace(/-/g,'+').replace(/_/g,'/');
    try {return Uint8Array.from(atob(text),c=>c.charCodeAt(0));} catch {throw Error('Base64 格式不正確。');}
  }
  function keyBytes(key) {const raw=unb64(key,true);if(raw.length!==32) throw Error('Fernet 金鑰必須是 32 bytes 的 URL-safe Base64。');return raw;}
  async function keys(key) {
    const raw=keyBytes(key);
    return {sign:await crypto.subtle.importKey('raw',raw.slice(0,16),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']),aes:await crypto.subtle.importKey('raw',raw.slice(16),{name:'AES-CBC'},false,['encrypt','decrypt'])};
  }
  function parse(token) {
    const raw=unb64(token,true);
    if(raw.length<73 || raw[0]!==128 || (raw.length-57)%16!==0) throw Error('InvalidToken：token 結構不合法。');
    return {raw,body:raw.slice(0,-32),iv:raw.slice(9,25),ciphertext:raw.slice(25,-32),mac:raw.slice(-32)};
  }
  async function encrypt(key,data) {
    const k=await keys(key), iv=crypto.getRandomValues(new Uint8Array(16));
    const header=new Uint8Array(25);header[0]=128;
    new DataView(header.buffer).setBigUint64(1,BigInt(Math.floor(Date.now()/1000)),false);header.set(iv,9);
    // Web Crypto adds/removes PKCS#7 padding for AES-CBC.
    const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-CBC',iv},k.aes,bytes(data)));
    const body=concat(header,ciphertext),mac=new Uint8Array(await crypto.subtle.sign('HMAC',k.sign,body));
    return b64(concat(body,mac),true);
  }
  async function decrypt(key,token) {
    const k=await keys(key), p=parse(token);
    if(!await crypto.subtle.verify('HMAC',k.sign,p.mac,p.body)) throw Error('InvalidToken：HMAC 驗證失敗。金鑰不符，或資料遭到修改。');
    try{return new Uint8Array(await crypto.subtle.decrypt({name:'AES-CBC',iv:p.iv},k.aes,p.ciphertext));}catch{throw Error('InvalidToken：無法解密資料。');}
  }
  function pem(data) {return '-----BEGIN PUBLIC KEY-----\n'+b64(data).match(/.{1,64}/g).join('\n')+'\n-----END PUBLIC KEY-----';}
  async function generateRSA() {
    const keyPair=await crypto.subtle.generateKey({name:'RSA-PSS',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
    return {privateKey:keyPair.privateKey,publicPEM:pem(await crypto.subtle.exportKey('spki',keyPair.publicKey))};
  }
  async function signRSA(key,message) {return new Uint8Array(await crypto.subtle.sign({name:'RSA-PSS',saltLength:222},key,enc.encode(message)));}
  async function verifyRSA(publicPEM,signature,message) {
    const match=publicPEM.trim().match(/^-----BEGIN PUBLIC KEY-----\s*([A-Za-z0-9+/=\s]+)\s*-----END PUBLIC KEY-----$/);
    if(!match)throw Error('公鑰格式錯誤，請保留完整 PEM 標頭與結尾。');
    let key;try{key=await crypto.subtle.importKey('spki',unb64(match[1]),{name:'RSA-PSS',hash:'SHA-256'},false,['verify']);}catch{throw Error('公鑰格式錯誤，需 RSA SHA-256 公鑰。');}
    return crypto.subtle.verify({name:'RSA-PSS',saltLength:222},key,bytes(signature),enc.encode(message));
  }
  function equal(a,b){return a.length===b.length&&a.every((v,i)=>v===b[i]);}
  function hex(data){return Array.from(data,v=>v.toString(16).padStart(2,'0')).join(' ');}
  function fromHex(text) {const s=text.replace(/\s/g,'');if(!s||s.length%2||!/^[0-9a-f]+$/i.test(s))throw Error('十六進位只能使用 0–9、a–f，每個 byte 需兩個字元。');return Uint8Array.from(s.match(/../g),v=>parseInt(v,16));}
  // Metadata is INSIDE the authenticated Fernet plaintext for pixel mode.
  function packPixels(rgba,width,height) {const head=enc.encode(JSON.stringify({kind:'rgba-v1',width,height}));const size=new Uint8Array(4);new DataView(size.buffer).setUint32(0,head.length);return concat(size,head,rgba);}
  function unpackPixels(data) {
    if(data.length<4)throw Error('像素資料不完整。');const n=new DataView(data.buffer,data.byteOffset,4).getUint32(0);
    if(n>1024||n+4>data.length)throw Error('像素標頭不合法。');const meta=JSON.parse(dec.decode(data.slice(4,4+n)));
    const {width,height}=meta;if(meta.kind!=='rgba-v1'||!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>8000000||data.length-4-n!==width*height*4)throw Error('像素尺寸或長度不符。');
    return {width,height,pixels:data.slice(4+n)};
  }
  window.CryptoDemo={enc,dec,b64,unb64,concat,parse,encrypt,decrypt,newKey:()=>b64(crypto.getRandomValues(new Uint8Array(32)),true),generateRSA,signRSA,verifyRSA,equal,hex,fromHex,packPixels,unpackPixels};
})();
