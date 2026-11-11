"""Pomiary poprawionych PNG, bez modyfikacji obrazów. Pillow tylko QA."""
from pathlib import Path
import json
import hashlib
from PIL import Image
root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'assets/kernelfall-v6-runtime/manifest.json').read_text())
rows = []
for record in manifest['files']:
    file = root / record['path']
    image = Image.open(file).convert('RGBA')
    alpha = image.getchannel('A')
    w, h = image.size
    edge = [alpha.getpixel((x, y)) for x in range(w) for y in (0, h-1)]
    edge += [alpha.getpixel((x, y)) for y in range(h) for x in (0, w-1)]
    ok = image.size == (256, 256) and hashlib.sha256(file.read_bytes()).hexdigest() == record['sha256'] and max(edge) <= 8
    rows.append({'path': record['path'], 'status': 'PASS' if ok else 'FAIL', 'alphaExtrema': alpha.getextrema(), 'maxBorderAlpha': max(edge)})
result = {'scope': 'SHA, rozmiary i alfa na granicy obrazu. Brak ucięcia nie jest automatycznym odbiorem estetycznym; krawędzie oceniono także na tle gry.', 'rows': rows}
(root / 'docs/art/kernelfall-v6/runtime/repaired-assets-results.json').write_text(json.dumps(result, indent=2, ensure_ascii=False)+'\n')
print(f"{sum(r['status']=='PASS' for r in rows)} PASS / {sum(r['status']=='FAIL' for r in rows)} FAIL")
raise SystemExit(any(r['status'] == 'FAIL' for r in rows))
