// <define:__ROUTES__>
var define_ROUTES_default = {
  version: 1,
  include: [
    "/*"
  ],
  exclude: [
    "/_fonts/*",
    "/_nuxt/*",
    "/.DS_Store",
    "/.DS_Store.br",
    "/.DS_Store.gz",
    "/favicon.svg",
    "/favicon.svg.br",
    "/favicon.svg.gz",
    "/logo.svg",
    "/logo.svg.br",
    "/logo.svg.gz"
  ]
};

// node_modules/wrangler/templates/pages-dev-pipeline.ts
import worker from "/Users/hugh/code/aihop/apay/.wrangler/tmp/pages-VFeCw3/bundledWorker-0.6660929574554927.mjs";
import { isRoutingRuleMatch } from "/Users/hugh/code/aihop/apay/node_modules/wrangler/templates/pages-dev-util.ts";
export * from "/Users/hugh/code/aihop/apay/.wrangler/tmp/pages-VFeCw3/bundledWorker-0.6660929574554927.mjs";
var routes = define_ROUTES_default;
var pages_dev_pipeline_default = {
  fetch(request, env, context) {
    const { pathname } = new URL(request.url);
    for (const exclude of routes.exclude) {
      if (isRoutingRuleMatch(pathname, exclude)) {
        return env.ASSETS.fetch(request);
      }
    }
    for (const include of routes.include) {
      if (isRoutingRuleMatch(pathname, include)) {
        const workerAsHandler = worker;
        if (workerAsHandler.fetch === void 0) {
          throw new TypeError("Entry point missing `fetch` handler");
        }
        return workerAsHandler.fetch(request, env, context);
      }
    }
    return env.ASSETS.fetch(request);
  }
};
export {
  pages_dev_pipeline_default as default
};
//# sourceMappingURL=5kvv8c0xsqe.js.map
