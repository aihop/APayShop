import{v as a}from"./server.mjs";function usePagination(e=15){const n=a.ref(1),r=a.ref(e);return{page:n,pageSize:r,onPageChange:async(a,e)=>{n.value=a,e&&await e()}}}export{usePagination as u};
//# sourceMappingURL=usePagination-COhC_xb7.mjs.map
