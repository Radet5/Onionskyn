// Structural comparison of two Documents (or Project files). Returns null when they are equal, otherwise a line naming the first field that differs,
// e.g. 'layers[2].kfs[0].ease: missing on the right'. opts.ignore lists whole paths to skip (volatile fields such as 'saved').
// A field set to undefined counts as missing, because JSON cannot hold it.
const kind=(v)=>v===null?'null':Array.isArray(v)?'array':typeof v;
const show=(v)=>{const k=kind(v);return k==='object'||k==='array'?k:typeof v==='string'?JSON.stringify(v.length>40?v.slice(0,40)+'…':v):String(v);};
exports.diffDocs=function(a,b,opts={}){
 const ignore=new Set(opts.ignore||[]);
 const walk=(x,y,p)=>{
  const kx=kind(x),ky=kind(y);
  if(kx!==ky)return p+': '+show(x)+' vs '+show(y);
  if(kx==='array'){
   if(x.length!==y.length)return p+': length '+x.length+' vs '+y.length;
   for(let i=0;i<x.length;i++){const r=walk(x[i],y[i],p+'['+i+']');if(r)return r;}
   return null;}
  if(kx==='object'){
   const keys=[...Object.keys(x),...Object.keys(y).filter(k=>!(k in x))];
   for(const k of keys){const q=p?p+'.'+k:k;if(ignore.has(q))continue;
    if(x[k]===undefined&&y[k]===undefined)continue;
    if(y[k]===undefined)return q+': missing on the right';
    if(x[k]===undefined)return q+': missing on the left';
    const r=walk(x[k],y[k],q);if(r)return r;}
   return null;}
  return x===y||Object.is(x,y)?null:p+': '+show(x)+' vs '+show(y);};
 return walk(a,b,'');};
