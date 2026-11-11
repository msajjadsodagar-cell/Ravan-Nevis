// copies offline libraries (JSZip, Vazirmatn font) into app/vendor
const fs = require('fs'), path = require('path');
const out = path.join(__dirname, '..', 'app', 'vendor');
const nm = path.join(__dirname, '..', 'node_modules');
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(path.join(nm, 'jszip', 'dist', 'jszip.min.js'), path.join(out, 'jszip.min.js'));
function find(d, re) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { const r = find(p, re); if (r) return r; }
    else if (re.test(e.name)) return p;
  }
  return null;
}
let css = '';
try {
  const dir = path.join(nm, 'vazirmatn');
  const f = find(dir, /^Vazirmatn.*wght.*\.woff2$/i) || find(dir, /\.woff2$/i);
  if (f) {
    fs.copyFileSync(f, path.join(out, 'Vazirmatn.woff2'));
    css = "@font-face{font-family:'Vazirmatn';src:url('Vazirmatn.woff2') format('woff2');font-weight:100 900;font-display:swap}";
  } else console.warn('Vazirmatn font not found; fallback fonts will be used');
} catch (e) { console.warn('font copy skipped:', e.message); }
fs.writeFileSync(path.join(out, 'fonts.css'), css);
console.log('vendor files ready');
