export const MAX_SOURCE_BYTES=10*1024*1024,MAX_PIXELS=24_000_000,MAX_AVATAR_BYTES=64*1024;
const invalid=()=>new Error('图片损坏或格式不支持，请选择静态 JPG、PNG 或 WebP');
const ascii=(b:Uint8Array,p:number,n:number)=>String.fromCharCode(...b.subarray(p,p+n));
function dimensions(width:number,height:number){if(!width||!height||width*height>MAX_PIXELS)throw Error('图片不得超过 2400 万像素');return {width,height};}
/** Parse bounded marker/chunk streams before asking the browser to decode a large source. */
export function inspectImage(b:Uint8Array){
 if(b.length>MAX_SOURCE_BYTES)throw Error('原图不能超过 10MB');
 const v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(b[0]===255&&b[1]===216){const j=jpeg(b);return {...dimensions(j.width,j.height),type:'image/jpeg'};}
 if(b.length>=33&&ascii(b,0,8)==='\x89PNG\r\n\x1a\n'){
  if(ascii(b,12,4)!=='IHDR'||v.getUint32(8)!==13)throw invalid();const size=dimensions(v.getUint32(16),v.getUint32(20));let p=8,end=false;
  while(p+12<=b.length){const n=v.getUint32(p),kind=ascii(b,p+4,4);if(n>b.length-p-12)throw invalid();if(kind==='acTL')throw Error('暂不支持动画图片');p+=n+12;if(kind==='IEND'){end=true;break;}}
  if(!end||p!==b.length)throw invalid();return {...size,type:'image/png'};
 }
 if(b.length>=30&&ascii(b,0,4)==='RIFF'&&ascii(b,8,4)==='WEBP'){
  if(v.getUint32(4,true)+8!==b.length)throw invalid();let p=12,size:{width:number;height:number}|undefined;
  const u24=(o:number)=>b[o]+b[o+1]*256+b[o+2]*65536;
  while(p+8<=b.length){const kind=ascii(b,p,4),n=v.getUint32(p+4,true),o=p+8;if(n>b.length-o)throw invalid();
   if(kind==='ANIM'||kind==='ANMF')throw Error('暂不支持动画图片');
   if(kind==='VP8X'&&n>=10){if(b[o]&2)throw Error('暂不支持动画图片');size=dimensions(u24(o+4)+1,u24(o+7)+1);}
   else if(kind==='VP8 '&&n>=10&&ascii(b,o+3,3)==='\x9d\x01\x2a')size??=dimensions(v.getUint16(o+6,true)&16383,v.getUint16(o+8,true)&16383);
   else if(kind==='VP8L'&&n>=5&&b[o]===47){const bits=v.getUint32(o+1,true);size??=dimensions((bits&16383)+1,((bits>>>14)&16383)+1);}
   p=o+n+(n%2);
  }
  if(!size||p!==b.length)throw invalid();return {...size,type:'image/webp'};
 }
 throw invalid();
}
/** JPEG marker validation and APP/COM stripping. The browser exports only the cropped raster. */
function jpeg(b:Uint8Array){
 if(b.length<4||b[0]!==255||b[1]!==216)throw invalid();const view=new DataView(b.buffer,b.byteOffset,b.byteLength),parts:Uint8Array[]=[b.subarray(0,2)];let p=2,width=0,height=0,scan=false,tables=false,entropy=0;
 while(p<b.length){const start=p;if(b[p++]!==255)throw invalid();while(b[p]===255)p++;const marker=b[p++];
  if(marker===217){if(!scan||!tables||!width||!entropy||p!==b.length)throw invalid();parts.push(b.subarray(start,p));const clean=new Uint8Array(parts.reduce((n,s)=>n+s.length,0));let at=0;for(const part of parts){clean.set(part,at);at+=part.length;}return {width,height,clean};}
  if(marker===0||marker===216||marker>=208&&marker<=215||p+2>b.length)throw invalid();const length=view.getUint16(p);if(length<2||p+length>b.length)throw invalid();const end=p+length;
  if([192,193,194].includes(marker)){if(length<11||width)throw invalid();height=view.getUint16(p+3);width=view.getUint16(p+5);dimensions(width,height);if(b[p+2]!==8||length!==8+3*b[p+7])throw invalid();}
  else if(marker>=195&&marker<=207&&![196,200,204].includes(marker))throw invalid();
  if(marker===219)tables=true;
  if(!(marker>=224&&marker<=239)&&marker!==254)parts.push(b.subarray(start,end));
  p=end;
  if(marker===218){if(!width||length<6)throw invalid();scan=true;const scanStart=p;while(p<b.length){if(b[p]!==255){p++;entropy++;continue;}let q=p+1;while(b[q]===255)q++;if(b[q]===0||b[q]>=208&&b[q]<=215){p=q+1;continue;}break;}parts.push(b.subarray(scanStart,p));}
 }
 throw invalid();
}
export function sanitizeAvatar(b:Uint8Array){if(b.length>MAX_AVATAR_BYTES)throw Error('头像不能超过 64KB');const parsed=jpeg(b);if(parsed.width!==256||parsed.height!==256)throw Error('头像必须为 256×256 像素');return parsed.clean;}
export function cropRect(width:number,height:number,zoom:number,x:number,y:number){const size=Math.min(width,height)/Math.max(1,Math.min(3,zoom));const left=Math.max(0,Math.min(width-size,x*width-size/2)),top=Math.max(0,Math.min(height-size,y*height-size/2));return {left,top,size,x:(left+size/2)/width,y:(top+size/2)/height};}
