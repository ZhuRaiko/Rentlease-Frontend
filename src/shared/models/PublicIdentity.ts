export interface PublicIdentity {id:string;nickname:string|null;avatarUrl:string|null;avatarPath:string|null}
export interface OwnPublicIdentity extends PublicIdentity {version:string}
export const avatarByteLimit=3*1024*1024;
export const identityUuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
export function publicNickname(value:string){const nick=value.normalize('NFC').trim().replace(/\s+/g,' ');if(nick&&(!/^[\p{L}\p{N}][\p{L}\p{N} ._'\-]*[\p{L}\p{N}]$/u.test(nick)||Array.from(nick).length>30))throw new Error('Use 2–30 letters or numbers, with spaces, periods, apostrophes, underscores, or hyphens.');return nick||null;}
export function publicAvatarPath(path:string,owner:string){if(!identityUuid(owner)||!new RegExp(`^${owner}/public/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png)$`).test(path))throw new Error('The public photo path is invalid.');return path;}
export const publicIdentityLabel=(identity:PublicIdentity|undefined|null,relationship:'owner'|'renter')=>identity?.nickname||(relationship==='owner'?'Property Owner':'Renter');
export class PublicIdentityError extends Error {constructor(message:string,public uncertain=false,public denied=false){super(message);}}
/** Preserve JPEG/PNG pixels while dropping EXIF/XMP/IPTC/comments/text/trailers. */
export function preparePublicAvatar(input:Uint8Array):{bytes:Uint8Array;mime:'image/jpeg'|'image/png';extension:'jpg'|'png'}{
 if(input.length<12||input.length>avatarByteLimit)throw new Error('Choose a JPEG or PNG photo up to 3 MB.');
 const parts:Uint8Array[]=[];let mime:'image/jpeg'|'image/png',extension:'jpg'|'png';
 if(input[0]===255&&input[1]===216){mime='image/jpeg';extension='jpg';parts.push(input.slice(0,2));let at=2,done=false;
  while(at<input.length){const start=at;if(input[at++]!==255)throw new Error('The JPEG photo could not be read.');while(input[at]===255)at++;const marker=input[at++];
   if(marker===217){parts.push(new Uint8Array([255,217]));done=true;break;}
   if(marker===undefined||at+2>input.length)throw new Error('The JPEG photo could not be read.');
   const length=input[at]!*256+input[at+1]!;if(length<2||at+length>input.length)throw new Error('The JPEG photo could not be read.');
   at+=length;if(![225,237,254].includes(marker))parts.push(input.slice(start,at));
   if(marker===218){const scan=at;while(at<input.length){if(input[at]!==255){at++;continue;}const next=input[at+1];if(next===0||(next!==undefined&&next>=208&&next<=215)){at+=2;continue;}break;}parts.push(input.slice(scan,at));}
  }if(!done)throw new Error('The JPEG photo is incomplete.');
 }else if([137,80,78,71,13,10,26,10].every((v,i)=>input[i]===v)){mime='image/png';extension='png';parts.push(input.slice(0,8));let at=8,done=false,header=false;
  while(at+12<=input.length){const length=input[at]!*16777216+input[at+1]!*65536+input[at+2]!*256+input[at+3]!,type=String.fromCharCode(...input.slice(at+4,at+8)),end=at+length+12;if(end>input.length)throw new Error('The PNG photo could not be read.');
   if(type==='IHDR')header=true;if(['IHDR','PLTE','IDAT','IEND','tRNS','gAMA','cHRM','sRGB','iCCP','sBIT'].includes(type))parts.push(input.slice(at,end));at=end;if(type==='IEND'){done=true;break;}
  }if(!done||!header)throw new Error('The PNG photo is incomplete.');
 }else throw new Error('Choose a JPEG or PNG photo.');
 const bytes=new Uint8Array(parts.reduce((sum,p)=>sum+p.length,0));let at=0;for(const part of parts){bytes.set(part,at);at+=part.length;}return{bytes,mime,extension};
}
