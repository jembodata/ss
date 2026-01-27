export function layout(title, bodyHtml) {
  return `<!doctype html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
body{font-family:system-ui;margin:24px;max-width:1100px}
a{color:#0b63ce;text-decoration:none} a:hover{text-decoration:underline}
.card{border:1px solid #e5e7eb;border-radius:12px;padding:16px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.row{display:flex;gap:24px;align-items:flex-start}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
label{display:block;font-size:12px;color:#374151;margin-top:10px}
input,textarea,select{width:100%;padding:10px;border:1px solid #d1d5db;border-radius:10px;font-size:14px}
textarea{min-height:140px;font-family:ui-monospace,Menlo,Consolas,monospace}
button{padding:10px 14px;border-radius:10px;border:1px solid #111827;background:#111827;color:#fff;cursor:pointer}
table{width:100%;border-collapse:collapse}
th,td{border-bottom:1px solid #eee;padding:10px;text-align:left;font-size:14px;vertical-align:top}
.muted{color:#6b7280;font-size:13px}
.pill{display:inline-block;padding:2px 8px;border-radius:999px;background:#f3f4f6;font-size:12px}
.ok{background:#dcfce7}.bad{background:#fee2e2}
.mono{font-family:ui-monospace,Menlo,Consolas,monospace}
.actions{display:flex;gap:10px;flex-wrap:wrap}
.small{font-size:12px}
</style>
</head><body>
<div class="actions" style="margin-bottom:16px">
  <a href="/">Home</a>
  <a href="/profiles">Profiles</a>
  <a href="/jobs">Jobs</a>
</div>
<h1 style="margin-top:0">${escapeHtml(title)}</h1>
${bodyHtml}
</body></html>`;
}

export function escapeHtml(s) {
  return String(s)
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
