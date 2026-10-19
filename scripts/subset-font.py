"""Regenerate Inter's first-load subset: pip install fonttools brotli; python scripts/subset-font.py.
Keep the original, its license and a complementary unicode-range for all other glyphs.
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools import subset
root = Path(__file__).resolve().parents[1]
source = root / 'public/fonts/InterVariable.woff2'
font = TTFont(source)
coverage = set(font.getBestCmap())
ranges = [(0,0x017F),(0x0300,0x036F),(0x0400,0x045F),(0x2000,0x206F),(0x20A0,0x20CF),(0x2116,0x2116),(0x2190,0x2199),(0x2212,0x2212),(0x2661,0x2661),(0xFEFF,0xFEFF),(0xFFFD,0xFFFD)]
common = {c for c in coverage if any(a<=c<=b for a,b in ranges)}
def css_ranges(points):
    intervals=[]
    for c in sorted(points):
        if intervals and intervals[-1][1]+1==c: intervals[-1][1]=c
        else: intervals.append([c,c])
    return ','.join(f'U+{a:X}' if a==b else f'U+{a:X}-{b:X}' for a,b in intervals)
options=subset.Options()
options.flavor='woff2'
options.hinting=False
options.layout_features=["ccmp","locl","rlig","rclt","rvrn","kern","liga","clig","calt","mark","mkmk","tnum"]
subsetter=subset.Subsetter(options=options)
subsetter.populate(unicodes=common)
subsetter.subset(font)
font.flavor='woff2'
target = root / 'public/fonts/Inter-latin-cyrillic.woff2'
font.save(target)
original, reduced = TTFont(source), TTFont(target)
assert {a.axisTag for a in original['fvar'].axes} == {a.axisTag for a in reduced['fvar'].axes}
assert common <= set(reduced.getBestCmap())
for c in common:
    assert original['hmtx'].metrics[original.getBestCmap()[c]][0] == reduced['hmtx'].metrics[reduced.getBestCmap()[c]][0]
css=root / 'assets/css/design-system.css'
text=css.read_text()
end=text.index(':root {')
faces=''
for path,chars in [('Inter-latin-cyrillic.woff2',common),('InterVariable.woff2',coverage-common)]:
    if chars:
        faces+=f'''@font-face {{
  font-family: "Inter";
  src: url("/fonts/{path}") format("woff2");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
  unicode-range: {css_ranges(chars)};
}}
'''
css.write_text(faces+text[end:])
print(source.stat().st_size, '->', (root / 'public/fonts/Inter-latin-cyrillic.woff2').stat().st_size)
