const r=[],registerCollectProvider=o=>{r.some(r=>r.id===o.id)||r.push(o)},resolveCollectProvider=o=>{for(const t of r){const r=t.matchUrl(o);if(r)return{provider:t,sourceProductId:r}}return null};export{registerCollectProvider,resolveCollectProvider};
//# sourceMappingURL=registry.mjs.map
