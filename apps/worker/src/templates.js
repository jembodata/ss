export function applyTemplate(str, ctx) {
  if (typeof str !== "string") return str;
  return str.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, path) => {
    const val = getPath(ctx, path.trim());
    return val == null ? "" : String(val);
  });
}
function getPath(obj, path) {
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}
