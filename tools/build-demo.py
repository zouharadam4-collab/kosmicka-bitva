# Sestaví public/demo.html (ukázka bez serveru) – vloží render.js dovnitř jedné stránky.
import pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = (root / 'tools' / 'demo.src.html').read_text(encoding='utf-8')
js = (root / 'public' / 'render.js').read_text(encoding='utf-8')
assert '</script' not in js
out = src.replace('<!--RENDER_JS-->', '<script>\n' + js + '\n</script>')
(root / 'public' / 'demo.html').write_text(out, encoding='utf-8')
print('demo.html', len(out) // 1024, 'kB')
