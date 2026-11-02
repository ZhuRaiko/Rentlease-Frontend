/** Presentation geometry only. No mutation occurs until a completed drop. */
export function photoDropIndex(from:number,dx:number,dy:number,scrollDelta:number,size:number,gap:number,count:number){
 if(count<=0||size<=0)return 0;
 const stride=size+gap;
 const column=Math.max(0,Math.min(1,Math.floor(((from%2)*stride+size/2+dx)/stride)));
 const row=Math.max(0,Math.floor((Math.floor(from/2)*stride+size/2+dy+scrollDelta)/stride));
 return Math.min(count-1,row*2+column);
}
export function movePhotoIds(ids:readonly string[],from:number,to:number):string[]{
 if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=ids.length||to>=ids.length)throw new Error('Invalid photo position');
 const result=[...ids];result.splice(to,0,result.splice(from,1)[0]!);return result;
}
