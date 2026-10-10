// For npm run test:db only: "server-only" throws outside Next, so it becomes an empty module
// (CommonJS for tsx-compiled app code, ESM otherwise).
import Module, { register } from "node:module";
import { fileURLToPath } from "node:url";
const empty = fileURLToPath(new URL("./empty.cjs", import.meta.url));
const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) { return req === "server-only" ? empty : orig.call(this, req, ...rest); };
register("data:text/javascript," + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  if (spec === "server-only") return { url: "data:text/javascript,export {}", shortCircuit: true };
  return next(spec, ctx);
}`));
