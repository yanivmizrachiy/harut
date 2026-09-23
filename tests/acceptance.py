"""Acceptance gates for a standalone A4 workbook repository (maagal / galil / harut).

Run:  python tests/acceptance.py            (all gates)
      python tests/acceptance.py --static   (skip browser gates)
Browser: Playwright Chromium. Locally you may set ACCEPTANCE_CHANNEL=chrome to use an installed Chrome.

The contract being tested is defined in RULES.md (the only source of truth). workbook.json is the
machine-readable page/question registry that RULES.md requires; this file only enforces it.
"""
from __future__ import annotations

import difflib, hashlib, json, os, re, sys, threading, unicodedata
from functools import partial
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent.parent
WB = json.loads((ROOT / "workbook.json").read_text(encoding="utf8"))
PAGES = WB["pages"]
N = WB["pageCount"]
RESULTS: list[tuple[str, bool, str]] = []

CURRICULUM_ONE = "שאלה מתוך תוכנית הלימודים"
CURRICULUM_MANY = "שאלות מתוך תוכנית הלימודים"


def gate(name):
    def deco(fn):
        def run():
            try:
                problems = fn() or []
            except Exception as e:  # a crashing gate is a failing gate
                problems = [f"gate crashed: {e!r}"]
            RESULTS.append((name, not problems, "; ".join(problems[:12]) + (f" … (+{len(problems) - 12})" if len(problems) > 12 else "")))
        run.gate_name = name
        return run
    return deco


# ---------------------------------------------------------------- minimal DOM
class Node:
    __slots__ = ("tag", "attrs", "children", "parent", "text")

    def __init__(self, tag, attrs=None, parent=None):
        self.tag, self.attrs, self.children, self.parent, self.text = tag, dict(attrs or {}), [], parent, ""

    def cls(self):
        return (self.attrs.get("class") or "").split()

    def iter(self):
        yield self
        for c in self.children:
            if isinstance(c, Node):
                yield from c.iter()

    def inner_text(self):
        out = []
        for c in self.children:
            if isinstance(c, Node):
                if c.tag not in ("script", "style") and "visually-hidden" not in c.cls() and c.attrs.get("aria-hidden") != "true":
                    out.append(c.inner_text())
            else:
                out.append(c)
        return re.sub(r"\s+", " ", " ".join(out)).strip()

    def first_element_child(self):
        return next((c for c in self.children if isinstance(c, Node)), None)


VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr", "path", "circle", "line", "rect", "polygon", "polyline", "ellipse", "stop", "use"}


class Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("#root")
        self.cur = self.root

    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs, self.cur)
        self.cur.children.append(n)
        if tag not in VOID:
            self.cur = n

    def handle_startendtag(self, tag, attrs):
        self.cur.children.append(Node(tag, attrs, self.cur))

    def handle_endtag(self, tag):
        n = self.cur
        while n is not self.root and n.tag != tag:
            n = n.parent
        if n is not self.root:
            self.cur = n.parent

    def handle_data(self, data):
        self.cur.children.append(data)


_DOM: dict[str, Node] = {}


def dom(path: Path) -> Node:
    key = str(path)
    if key not in _DOM:
        p = Parser()
        p.feed(path.read_text(encoding="utf8"))
        _DOM[key] = p.root
    return _DOM[key]


def page_files():
    return [ROOT / p["file"] for p in PAGES]


def norm(t: str) -> str:
    t = unicodedata.normalize("NFC", t)
    for a, b in (("״", '"'), ("׳", "'"), ("−", "-"), ("–", "-"), ("‏", ""), ("‎", ""), (" ", " ")):
        t = t.replace(a, b)
    t = re.sub(r"_{2,}", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def questions(root: Node):
    return [n for n in root.iter() if "data-q" in n.attrs]


def bullet_leads(block: Node, cls: str) -> bool:
    """True when the block's first bullet of class `cls` comes before any visible text of the block."""
    def walk(n):
        for c in n.children:
            if isinstance(c, str):
                if c.strip():
                    return False
            elif cls in c.cls():
                return True
            elif c.tag not in ("script", "style"):
                r = walk(c)
                if r is not None:
                    return r
        return None
    return walk(block) is True


# ---------------------------------------------------------------- static gates
@gate("page numbering")
def g_numbering():
    bad = []
    files = sorted(int(m.group(1)) for f in ROOT.glob("page-*.html") if (m := re.fullmatch(r"page-(\d+)\.html", f.name)))
    if files != list(range(1, N + 1)):
        bad.append(f"page files are not exactly 1..{N}: {files[:5]}…{files[-5:]}")
    if [p["n"] for p in PAGES] != list(range(1, N + 1)):
        bad.append("workbook.json pages[].n is not 1..pageCount in order")
    for p in PAGES:
        r = dom(ROOT / p["file"])
        mains = [n for n in r.iter() if n.tag == "main" and "a4-page" in n.cls()]
        if len(mains) != 1:
            bad.append(f"{p['file']}: {len(mains)} main.a4-page (need 1)")
            continue
        nums = [n for n in mains[0].iter() if {"page-number", "local-page-number"} & set(n.cls())]
        if len(nums) != 1 or nums[0].inner_text() != str(p["n"]):
            bad.append(f"{p['file']}: visible page number {[x.inner_text() for x in nums]} != {p['n']}")
    return bad


NUM_START = re.compile(r"^\s*(?:שאלה\s*)?(?:\d{1,2}|[א-ת]['׳]?)\s*[.)]\s")
PAREN_LABEL = re.compile(r"^\s*\((?:\d{1,2}|[א-ת])\)\s")


@gate("no visible question numbering")
def g_no_qnum():
    bad = []
    for f in page_files():
        r = dom(f)
        for n in r.iter():
            c = n.cls()
            if ("task-num" in c or "q-bullet" in c or "qnum" in c) and re.search(r"\d", n.inner_text() + "".join(x for x in n.children if isinstance(x, str))):
                bad.append(f"{f.name}: numbered marker '{n.inner_text()}'")
        for q in questions(r):
            if q.attrs.get("data-keep-label") is not None:
                continue
            txt = q.inner_text()
            if NUM_START.match(txt) or PAREN_LABEL.match(txt):
                bad.append(f"{f.name} {q.attrs['data-q']}: starts with a number/label: {txt[:30]!r}")
    return bad


@gate("question bullets")
def g_qbullets():
    bad, total = [], 0
    for f in page_files():
        for q in questions(dom(f)):
            total += 1
            if not bullet_leads(q, "q-bullet"):
                bad.append(f"{f.name} {q.attrs['data-q']}: question text starts before its .q-bullet")
            if sum("q-bullet" in n.cls() for n in q.iter()) != 1:
                bad.append(f"{f.name} {q.attrs['data-q']}: must contain exactly one .q-bullet")
    if total == 0:
        bad.append("no [data-q] question blocks found")
    return bad


@gate("subsection bullets")
def g_subbullets():
    bad = []
    for f in page_files():
        for s in (n for n in dom(f).iter() if "data-sub" in n.attrs):
            if not bullet_leads(s, "sub-bullet"):
                bad.append(f"{f.name}: [data-sub] without leading .sub-bullet: {s.inner_text()[:30]!r}")
            if s.attrs.get("data-keep-label") is None and (NUM_START.match(s.inner_text()) or PAREN_LABEL.match(s.inner_text())):
                bad.append(f"{f.name}: sub-part still shows a label: {s.inner_text()[:30]!r}")
    return bad


@gate("curriculum heading correctness")
def g_curriculum():
    bad = []
    reg = {q["id"]: q for q in WB["questions"]}
    for p in PAGES:
        r = dom(ROOT / p["file"])
        cur = [q for q in questions(r) if q.attrs.get("data-curriculum")]
        heads = [n for n in r.iter() if "curriculum-heading" in n.cls()]
        texts = [h.inner_text() for h in heads]
        for q in questions(r):
            cid = q.attrs.get("data-curriculum")
            wq = reg.get(q.attrs["data-q"], {})
            if bool(cid) != bool(wq.get("curriculum")):
                bad.append(f"{p['file']} {q.attrs['data-q']}: data-curriculum does not match workbook.json")
            if cid and not wq.get("curriculumProof"):
                bad.append(f"{p['file']} {q.attrs['data-q']}: curriculum question without curriculumProof")
        if not cur and heads:
            bad.append(f"{p['file']}: curriculum heading on a page without curriculum-source questions")
        if cur:
            want = CURRICULUM_ONE if len(cur) == 1 else CURRICULUM_MANY
            if texts != [want]:
                bad.append(f"{p['file']}: {len(cur)} curriculum question(s) needs exactly one heading '{want}', found {texts}")
        body = " ".join(n.inner_text() for n in r.iter() if n.tag == "main")
        for phrase in (CURRICULUM_ONE, CURRICULUM_MANY):
            if body.count(phrase) > (1 if phrase in texts else 0):
                bad.append(f"{p['file']}: stray '{phrase}' text")
    return bad


@gate("provenance completeness")
def g_provenance():
    bad = []
    prov = (ROOT / "PROVENANCE.md").read_text(encoding="utf8")
    reg = {q["id"]: q for q in WB["questions"]}
    seen = set()
    for p in PAGES:
        for q in questions(dom(ROOT / p["file"])):
            qid = q.attrs["data-q"]
            if qid in seen:
                bad.append(f"duplicate question id {qid}")
            seen.add(qid)
            w = reg.get(qid)
            if not w:
                bad.append(f"{p['file']}: {qid} missing from workbook.json")
                continue
            if w.get("page") != p["n"]:
                bad.append(f"{qid}: workbook.json page {w.get('page')} != {p['n']}")
            src = w.get("source", "")
            m = re.fullmatch(r"([\w.-]+/[\w.-]+)@([0-9a-f]{7,40}):(.+)", src)
            if not m:
                bad.append(f"{qid}: source '{src}' is not owner/repo@sha:path")
            elif m.group(2)[:7] not in prov:
                bad.append(f"{qid}: source commit {m.group(2)[:7]} not documented in PROVENANCE.md")
    missing = set(reg) - seen
    if missing:
        bad.append(f"workbook.json lists questions not on any page: {sorted(missing)[:5]}")
    cov = ROOT / "provenance" / "coverage.json"
    if not cov.exists():
        bad.append("provenance/coverage.json missing")
    else:
        rows = json.loads(cov.read_text(encoding="utf8"))["rows"]
        for r_ in rows:
            if r_.get("status") not in ("imported", "duplicate", "irrelevant", "other-repo"):
                bad.append(f"coverage row {r_.get('id')}: status {r_.get('status')!r} not accounted")
            if r_.get("status") == "imported" and r_.get("questionId") not in seen:
                bad.append(f"coverage row {r_.get('id')}: imported but question {r_.get('questionId')} not in workbook")
    return bad


@gate("duplicate detection")
def g_dupes():
    bad = []
    allowed = {tuple(sorted(x)) for x in WB.get("allowedSimilar", [])}
    texts = []
    for p in PAGES:
        for q in questions(dom(ROOT / p["file"])):
            t = norm(q.inner_text())
            if len(t) >= 40:
                texts.append((q.attrs["data-q"], t))
    by_hash = {}
    for qid, t in texts:
        by_hash.setdefault(hashlib.sha1(t.encode()).hexdigest(), []).append(qid)
    for ids in by_hash.values():
        if len(ids) > 1:
            bad.append(f"exact duplicate questions: {ids}")
    for i in range(len(texts)):
        for j in range(i + 1, len(texts)):
            (a, ta), (b, tb) = texts[i], texts[j]
            if min(len(ta), len(tb)) / max(len(ta), len(tb)) < 0.85:
                continue
            sm = difflib.SequenceMatcher(None, ta, tb, autojunk=False)
            if sm.quick_ratio() >= 0.92 and sm.ratio() >= 0.92 and tuple(sorted((a, b))) not in allowed:
                bad.append(f"near-duplicate {a} ~ {b} ({sm.ratio():.2f}) — dedupe or list in allowedSimilar with a reason")
    return bad


@gate("topic leakage")
def g_leak():
    bad = []
    rules = WB.get("forbiddenTerms", [])
    for p in PAGES:
        allow = set(p.get("allowTerms", []))
        text = " ".join(n.inner_text() for n in dom(ROOT / p["file"]).iter() if n.tag == "main")
        for term in rules:
            if term not in allow and re.search(term, text):
                bad.append(f"{p['file']}: contains '{term}' (another topic)")
    return bad


def local_refs(f: Path):
    s = f.read_text(encoding="utf8")
    for m in re.finditer(r"""(?:href|src)\s*=\s*["']([^"'#]+)["']|url\(\s*["']?([^"')]+)["']?\s*\)""", s):
        yield (m.group(1) or m.group(2)).strip()


@gate("broken links/assets")
def g_links():
    bad = []
    scan = [f for f in ROOT.rglob("*") if f.suffix in (".html", ".css") and "vendor" not in f.relative_to(ROOT).parts and "tests" not in f.relative_to(ROOT).parts and ".git" not in f.parts]
    for f in scan:
        for ref in local_refs(f):
            if ref.startswith(("data:", "mailto:", "javascript:", "about:")):
                continue
            u = urlparse(ref)
            if u.scheme in ("http", "https"):
                if f.suffix == ".html" and re.search(r"<(?:script|link|img)[^>]+" + re.escape(ref), f.read_text(encoding="utf8")):
                    if not ref.startswith("http://www.w3.org"):
                        bad.append(f"{f.name}: runtime dependency on external URL {ref}")
                continue
            if ref.startswith("/"):
                bad.append(f"{f.name}: root-absolute path {ref} breaks on GitHub Pages")
                continue
            target = (f.parent / unquote(u.path)).resolve()
            if not target.exists() or ROOT.resolve() not in target.parents and target != ROOT.resolve():
                bad.append(f"{f.relative_to(ROOT)} -> {ref}")
    for dep in ("razpages", "smartschool-hebrew-voice-notes", "bbb-ten-plum", "/bbb/"):
        for f in page_files():
            if dep in f.read_text(encoding="utf8"):
                bad.append(f"{f.name}: references source repo '{dep}' at runtime")
    return bad


@gate("RTL")
def g_rtl():
    bad = []
    for f in page_files() + [ROOT / "index.html", ROOT / "print.html"]:
        if not f.exists():
            bad.append(f"{f.name} missing")
            continue
        html = next((n for n in dom(f).iter() if n.tag == "html"), None)
        if not html or html.attrs.get("lang") != "he" or html.attrs.get("dir") != "rtl":
            bad.append(f"{f.name}: <html lang=he dir=rtl> missing")
        if not re.search(r'<meta charset="utf-8"', f.read_text(encoding="utf8"), re.I):
            bad.append(f"{f.name}: missing <meta charset=utf-8>")
    return bad


@gate("mathematical notation")
def g_math():
    bad = []
    allow_exact_pi = set(WB.get("allowExactPiLayouts", []))
    for p in PAGES:
        f = ROOT / p["file"]
        raw = f.read_text(encoding="utf8")
        text = " ".join(n.inner_text() for n in dom(f).iter() if n.tag == "main")
        tex = re.sub(r"\\\(|\\\)", "", text).replace("\\pi", "π").replace("\\approx", "≈").replace("\\cdot", "·")
        if re.search(r"\d\s*\*\s*\d", tex):
            bad.append(f"{f.name}: '*' used as multiplication")
        if re.search(r"(?<![A-Za-z])\d+\s*[xX]\s*\d+(?![A-Za-z])", tex) and "allowX" not in p:
            bad.append(f"{f.name}: x/X used as multiplication")
        if re.search(r"π\s*=\s*3[.,]14(?!\d)", tex) and p.get("layout") not in allow_exact_pi:
            bad.append(f"{f.name}: π written as exactly 3.14 (use ≈)")
        if raw.count("\\(") != raw.count("\\)"):
            bad.append(f"{f.name}: unbalanced \\( \\) math delimiters")
        if re.search(r"(?:ס״מ|סמ\"ר|סמ\"ק|מ״ר|סמ״ר|מ״מ|ס\"מ|מ\"ר)[23](?![\d.,])", text):
            bad.append(f"{f.name}: unit power written as a plain digit (use ² / ³)")
        if re.search(r"\b(demo|placeholder|TODO|lorem|mock)\b", text, re.I):
            bad.append(f"{f.name}: internal/demo text visible")
    return bad


@gate("generated files up to date")
def g_generated():
    import subprocess
    r = subprocess.run([sys.executable, str(ROOT / "tools" / "build.py"), "--check"], capture_output=True, text=True, encoding="utf8")
    return [] if r.returncode == 0 else [r.stdout.strip() or r.stderr.strip()]


@gate("A4 CSS contract")
def g_a4_css():
    css = " ".join(p.read_text(encoding="utf8") for p in ROOT.rglob("*.css") if "vendor" not in p.parts)
    bad = []
    if not re.search(r"@page\s*\{[^}]*size\s*:\s*A4", css):
        bad.append("no @page { size: A4 } rule")
    if not re.search(r"210mm", css) or not re.search(r"297mm", css):
        bad.append("no 210mm × 297mm page box")
    return bad


# ---------------------------------------------------------------- browser gates
class _Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def _serve():
    srv = ThreadingHTTPServer(("127.0.0.1", 0), partial(_Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


LAYOUT_JS = r"""
() => {
  const m = document.querySelector('main.a4-page'); const r = m.getBoundingClientRect();
  const mm = 96 / 25.4, out = {w: r.width, h: r.height, overflow: [], clipped: [], badImg: [], rawTex: 0};
  if (m.scrollHeight > m.clientHeight + 1 || m.scrollWidth > m.clientWidth + 1) out.overflow.push(`main scroll ${m.scrollWidth}x${m.scrollHeight} > ${m.clientWidth}x${m.clientHeight}`);
  for (const e of m.querySelectorAll('*')) {
    if (e.closest('svg') && e.tagName.toLowerCase() !== 'svg') continue;
    const b = e.getBoundingClientRect();
    if (!b.width || !b.height) continue;
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || cs.display === 'none' || e.closest('.visually-hidden, [data-print-hidden]')) continue;
    if (b.left < r.left - 1 || b.right > r.right + 1 || b.top < r.top - 1 || b.bottom > r.bottom + 1)
      out.overflow.push(`${e.tagName.toLowerCase()}.${[...e.classList].join('.')} outside page (${Math.round(b.left-r.left)},${Math.round(b.top-r.top)} ${Math.round(b.width)}x${Math.round(b.height)})`);
    if (['hidden','clip'].includes(cs.overflowY) && e.scrollHeight > e.clientHeight + 2 && e.clientHeight > 0 && e.innerText.trim())
      out.clipped.push(`${e.tagName.toLowerCase()}.${[...e.classList].join('.')} clips ${e.scrollHeight - e.clientHeight}px`);
  }
  for (const i of document.images) if (!i.complete || !i.naturalWidth) out.badImg.push(i.getAttribute('src'));
  out.rawTex = (m.innerText.match(/\\\(|\\pi|\\frac|\\cdot/g) || []).length;
  return out;
}
"""


def browser_gates():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        RESULTS.append(("browser gates", False, "playwright not installed (pip install playwright && python -m playwright install chromium)"))
        return
    srv = _serve()
    base = f"http://127.0.0.1:{srv.server_address[1]}"
    a4, overflow, net, printing, math_render = [], [], [], [], []
    with sync_playwright() as p:
        ch = os.environ.get("ACCEPTANCE_CHANNEL")
        br = p.chromium.launch(**({"channel": ch} if ch else {}))
        ctx = br.new_context(viewport={"width": 900, "height": 1200})
        pg = ctx.new_page()
        failed = []
        pg.on("requestfailed", lambda r: failed.append(r.url))
        pg.on("response", lambda r: failed.append(f"{r.status} {r.url}") if r.status >= 400 else None)
        shots = os.environ.get("ACCEPTANCE_SCREENSHOTS")
        for pmeta in PAGES:
            failed.clear()
            pg.goto(f"{base}/{pmeta['file']}", wait_until="networkidle")
            if pg.evaluate("!!(window.MathJax && MathJax.startup && MathJax.startup.promise)"):
                pg.evaluate("MathJax.startup.promise")
            pg.evaluate("document.fonts.ready")
            L = pg.evaluate(LAYOUT_JS)
            if abs(L["w"] - 210 * 96 / 25.4) > 1 or abs(L["h"] - 297 * 96 / 25.4) > 1:
                a4.append(f"{pmeta['file']}: {L['w']:.1f}×{L['h']:.1f}px")
            overflow += [f"{pmeta['file']}: {x}" for x in L["overflow"] + L["clipped"]]
            net += [f"{pmeta['file']}: {x}" for x in failed + [f"broken image {s}" for s in L["badImg"]]]
            if L["rawTex"]:
                math_render.append(f"{pmeta['file']}: {L['rawTex']} raw TeX fragments left after MathJax")
            if shots:
                Path(shots).mkdir(parents=True, exist_ok=True)
                pg.locator("main.a4-page").screenshot(path=str(Path(shots) / f"page-{pmeta['n']:03d}.png"))
            pdf = pg.pdf(prefer_css_page_size=True, print_background=True)
            pages_in_pdf = len(re.findall(rb"/Type\s*/Page(?!s)", pdf))
            if pages_in_pdf != 1:
                printing.append(f"{pmeta['file']}: prints as {pages_in_pdf} PDF pages")
        pg.goto(f"{base}/print.html", wait_until="networkidle")
        if pg.evaluate("!!(window.MathJax && MathJax.startup && MathJax.startup.promise)"):
            pg.evaluate("MathJax.startup.promise")
        pdf = pg.pdf(prefer_css_page_size=True, print_background=True)
        total = len(re.findall(rb"/Type\s*/Page(?!s)", pdf))
        if total != N:
            printing.append(f"print.html prints as {total} pages, expected {N}")
        br.close()
    srv.shutdown()
    RESULTS.append(("A4 dimensions (rendered)", not a4, "; ".join(a4[:12])))
    RESULTS.append(("overflow/clipping (rendered)", not overflow, "; ".join(overflow[:12]) + (f" … (+{len(overflow)-12})" if len(overflow) > 12 else "")))
    RESULTS.append(("broken links/assets (rendered)", not net, "; ".join(net[:12])))
    RESULTS.append(("mathematical notation (rendered)", not math_render, "; ".join(math_render[:12])))
    RESULTS.append(("print rendering", not printing, "; ".join(printing[:12])))


def main():
    for g in (g_numbering, g_no_qnum, g_qbullets, g_subbullets, g_curriculum, g_provenance, g_dupes, g_leak, g_links, g_rtl, g_math, g_generated, g_a4_css):
        g()
    if "--static" not in sys.argv:
        browser_gates()
    width = max(len(n) for n, _, _ in RESULTS)
    for name, ok, detail in RESULTS:
        print(f"{'PASS' if ok else 'FAIL'}  {name.ljust(width)}  {detail if not ok else ''}".rstrip())
    failed = [n for n, ok, _ in RESULTS if not ok]
    print(f"\n{len(RESULTS) - len(failed)}/{len(RESULTS)} gates passed ({WB['repo']}, {N} pages)")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
