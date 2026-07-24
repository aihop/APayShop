import{ck as n}from"../nitro/nitro.mjs";function findValuesBetween(e,t,i){const r=e.findIndex(e=>n(e,t)),o=e.findIndex(e=>n(e,i));if(-1===r||-1===o)return[];const[s,f]=[r,o].sort((n,e)=>n-e);return e.slice(s,f+1)}export{findValuesBetween as f};
//# sourceMappingURL=arrays-Dc15V_mx.mjs.map
