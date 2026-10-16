/* Folder Reader + Diff (v4)
   - Dual selection: pick any file in A and any in B (both stay visible)
   - Link selections: auto pick same relPath or exact-hash match
   - Manual compare: similarity scoring + suggestions for moved/renamed
   - Ignore: defaults + custom + .gitignore (nested)
   - Report: same/different/only/moved + CSV/JSON export
   - Bundle export: bundle_A / bundle_B / bundle_AB + index manifest
*/
(() => {
  "use strict";

  const DEFAULT_IGNORE = ["node_modules/**","dist/**",".venv/**","__pycache__/**",".git/**",".idea/**",".vscode/**"];
  const BIN_EXT_DENY = new Set(["png","jpg","jpeg","gif","webp","bmp","ico","svgz","pdf","zip","7z","rar","tar","gz","bz2","xz","exe","dll","so","dylib","bin","dat","mp3","wav","mp4","mov","avi","mkv","xlsx","xls","xlsm","pptx","ppt","docx","doc","ttf","otf","woff","woff2"]);
  const CODEISH_EXT = new Set(["py","js","mjs","cjs","ts","tsx","jsx","json","jsonl","yaml","yml","html","htm","css","scss","less","sql","sh","ps1","bat","cmd","xml","ini","cfg","conf","md","txt","gitignore","dockerfile","makefile"]);
  const PREVIEW_CHARS = 120_000;

  const SUGGEST_MAX_FILENAME_CANDIDATES = 250;
  const SUGGEST_TOP = 10;

  const $ = (id) => {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing #${id}`);
    return el;
  };

  const el = {
    metaA: $("metaA"), metaB: $("metaB"),
    dropA: $("dropA"), dropB: $("dropB"),
    treeA: $("treeA"), treeB: $("treeB"),
    searchA: $("searchA"), searchB: $("searchB"),
    filterA: $("filterA"), filterB: $("filterB"),
    pickA: $("pickA"), pickB: $("pickB"),
    customIgnore: $("customIgnore"), ignoreDefaults: $("ignoreDefaults"),
    activePath: $("activePath"), activeMeta: $("activeMeta"),
    toggleLink: $("toggleLink"),
    btnSuggestA: $("btnSuggestA"), btnSuggestB: $("btnSuggestB"),
    toggleDiff: $("toggleDiff"), diffMode: $("diffMode"),
    encodingMode: $("encodingMode"),
    btnExpand: $("btnExpand"), btnCopy: $("btnCopy"),
    paneWrap: $("paneWrap"), inlineWrap: $("inlineWrap"),
    codeA: $("codeA"), codeB: $("codeB"), codeInline: $("codeInline"),
    hintA: $("hintA"), hintB: $("hintB"), hintInline: $("hintInline"),
    reportMeta: $("reportMeta"), reportGrid: $("reportGrid"),
    similarityMeta: $("similarityMeta"), similarityGrid: $("similarityGrid"),
    suggestions: $("suggestions"),
    btnExportReportJson: $("btnExportReportJson"),
    btnExportReportCsv: $("btnExportReportCsv"),
    btnBundleA: $("btnBundleA"), btnBundleB: $("btnBundleB"), btnBundleBoth: $("btnBundleBoth"),
    btnClear: $("btnClear"), btnRecompute: $("btnRecompute"),
    statusbar: $("statusbar")
  };

  const state = {
    A: makeFolderState("A"),
    B: makeFolderState("B"),
    report: null,
    activeAPath: null,
    activeBPath: null,
    diffEnabled: false,
    diffLayout: "side",
    linkSelections: false,
    expanded: false,
    encodingMode: "auto",
  };

  function makeFolderState(label) {
    return {
      label,
      loaded: false,
      rootName: null,
      files: new Map(),    // fullPath -> rec (all files stored, text flagged)
      relIndex: new Map(), // relPath -> fullPath (text only)
      list: [],            // text recs sorted
      shaToRel: new Map(), // sha -> [relPath]
    };
  }

  // --------- init ---------
  renderDefaultIgnore();
  setDefaultCustomIgnore();
  wireDropZone(el.dropA, "A");
  wireDropZone(el.dropB, "B");

  el.pickA.addEventListener("change", async () => { if (el.pickA.files?.length) { await loadFromWebkit("A", el.pickA.files); el.pickA.value=""; } });
  el.pickB.addEventListener("change", async () => { if (el.pickB.files?.length) { await loadFromWebkit("B", el.pickB.files); el.pickB.value=""; } });

  el.searchA.addEventListener("input", () => renderTree("A"));
  el.searchB.addEventListener("input", () => renderTree("B"));
  el.filterA.addEventListener("change", () => renderTree("A"));
  el.filterB.addEventListener("change", () => renderTree("B"));

  el.toggleLink.addEventListener("change", () => { state.linkSelections = !!el.toggleLink.checked; setStatus(`Link selections: ${state.linkSelections ? "ON":"OFF"}`); });
  el.btnSuggestA.addEventListener("click", async () => { await suggestMatch("A"); });
  el.btnSuggestB.addEventListener("click", async () => { await suggestMatch("B"); });

  el.toggleDiff.addEventListener("change", () => { state.diffEnabled = !!el.toggleDiff.checked; renderViewer(); });
  el.diffMode.addEventListener("change", () => { state.diffLayout = el.diffMode.value; renderViewer(); });
  el.encodingMode.addEventListener("change", () => { state.encodingMode = el.encodingMode.value; setStatus(`Encoding mode set to ${state.encodingMode}. Reload folders to apply.`); });

  el.btnExpand.addEventListener("click", () => { state.expanded = !state.expanded; el.btnExpand.textContent = state.expanded ? "Collapse":"Expand"; renderViewer(); });
  el.btnCopy.addEventListener("click", async () => { const t = getCopyText(); await navigator.clipboard.writeText(t); setStatus(`Copied ${t.length.toLocaleString()} chars.`); });

  el.btnExportReportJson.addEventListener("click", () => exportReport("json"));
  el.btnExportReportCsv.addEventListener("click", () => exportReport("csv"));
  el.btnBundleA.addEventListener("click", () => exportBundle("A"));
  el.btnBundleB.addEventListener("click", () => exportBundle("B"));
  el.btnBundleBoth.addEventListener("click", () => exportBundle("both"));

  el.btnClear.addEventListener("click", clearAll);
  el.btnRecompute.addEventListener("click", async () => { await computeReport(); renderAll(); setStatus("Report recomputed."); });

  setStatus("Ready.");

  // --------- ignore ---------
  function renderDefaultIgnore() {
    el.ignoreDefaults.innerHTML = "";
    for (const p of DEFAULT_IGNORE) {
      const d = document.createElement("div");
      d.className = "pill";
      d.textContent = p;
      el.ignoreDefaults.appendChild(d);
    }
  }

  function setDefaultCustomIgnore() {
    el.customIgnore.value = [
      "# one pattern per line, supports * and **, ! for negation",
      "# examples:",
      "# *.min.js",
      "# build/**",
      ""
    ].join("\n");
  }

  function getCustomIgnorePatterns() {
    return el.customIgnore.value.split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith("#"));
  }

  function globToRegex(glob) {
    let g = glob.replaceAll("\\","/");
    const neg = g.startsWith("!");
    if (neg) g = g.slice(1).trim();

    const isDir = g.endsWith("/");
    if (isDir) g = g.slice(0,-1);
    if (!g.includes("/")) g = "**/" + g;

    let re = "^";
    const parts = g.split("/");
    for (let i=0;i<parts.length;i++) {
      const part = parts[i];
      if (part === "**") re += "(?:.*)";
      else re += part.replace(/[.+^${}()|[\]\\]/g,"\\$&").replaceAll("?","." ).replaceAll("*","[^/]*");
      if (i < parts.length-1) re += "/";
    }
    if (isDir) re += "(?:/.*)?";
    re += "$";
    return new RegExp(re);
  }

  function buildIgnoreEngine(patterns) {
    const rules = [];
    for (const raw of patterns) {
      const line = raw.trim();
      if (!line) continue;
      const neg = line.startsWith("!");
      rules.push({ neg, regex: globToRegex(line) });
    }
    return {
      shouldIgnore(relPath) {
        const p = relPath.replaceAll("\\","/");
        let ignored = false;
        for (const r of rules) if (r.regex.test(p)) ignored = !r.neg;
        return ignored;
      }
    };
  }

  // --------- loading ---------
  async function loadFromWebkit(which, fileList) {
    const folder = state[which];
    resetFolder(folder);

    const files = Array.from(fileList);
    folder.rootName = inferRoot(files) || `Folder_${which}`;

    const basePatterns = [...DEFAULT_IGNORE, ...getCustomIgnorePatterns()];
    const giMap = await buildGitignoreMap(files);

    const ignoreForRel = (rel) => buildIgnoreEngine([...basePatterns, ...collectGitignore(rel, giMap)]);

    setStatus(`Loading ${files.length} items into ${which}...`);

    for (const f of files) {
      const rawRel = (f.webkitRelativePath || f.name).replaceAll("\\","/");
      const root = folder.rootName ? String(folder.rootName).replaceAll("\\","/") : null;
      const rel = (root && rawRel.startsWith(root + "/")) ? rawRel.slice(root.length + 1) : rawRel;
      if (ignoreForRel(rel).shouldIgnore(rel)) continue;

      const fullPath = folder.rootName ? `${folder.rootName}/${rel}` : rel;
      const rec = await readAndClassify(f, fullPath, rel);
      folder.files.set(fullPath, rec);
      if (rec.isText) folder.relIndex.set(rel, fullPath);
    }

    finalizeFolder(folder);
    await computeReport();
    renderAll();
    setRootLabels();
    setStatus(`Loaded ${which}: ${folder.list.length} text files, ${folder.files.size} stored.`);
  }

  function inferRoot(files) {
    const p = files.find(f => f.webkitRelativePath)?.webkitRelativePath;
    return p ? (p.split("/")[0] || null) : null;
  }

  async function buildGitignoreMap(files) {
    const map = new Map(); // dir -> patterns[]
    const gi = files.filter(f => (f.webkitRelativePath||"").endsWith("/.gitignore") || f.name === ".gitignore");
    for (const f of gi) {
      const rel = (f.webkitRelativePath || f.name).replaceAll("\\","/");
      const dir = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
      try {
        const buf = await f.arrayBuffer();
        const txt = await decodeWithFallback(buf, state.encodingMode);
        const patterns = String(txt).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        map.set(dir, patterns);
      } catch {}
    }
    return map;
  }

  function collectGitignore(relPath, map) {
    const parts = relPath.split("/");
    const out = [];
    for (let i=0;i<parts.length;i++) {
      const dir = parts.slice(0,i).join("/");
      const p = map.get(dir);
      if (p?.length) out.push(...p);
    }
    return out;
  }

  function wireDropZone(zone, which) {
    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("dragover"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
    zone.addEventListener("drop", async (e) => {
      e.preventDefault(); zone.classList.remove("dragover");
      const items = Array.from(e.dataTransfer?.items || []);
      const entries = items.map(it => it.kind==="file" ? it.webkitGetAsEntry?.() : null).filter(Boolean);
      const dirs = entries.filter(en => en.isDirectory);
      if (!dirs.length) { setStatus("Drag/drop folders needs Chrome/Edge folder entries. Use Load Folder buttons."); return; }
      await loadFromEntries(which, dirs);
    });
  }

  async function loadFromEntries(which, dirEntries) {
    const folder = state[which];
    resetFolder(folder);
    const basePatterns = [...DEFAULT_IGNORE, ...getCustomIgnorePatterns()];
    const roots = [];
    for (const dir of dirEntries) { roots.push(dir.name || `Folder_${which}`); await walkEntry(dir, dir.name || `Folder_${which}`, folder, basePatterns, []); }
    folder.rootName = roots.length===1 ? roots[0] : `${which}: ${roots.length} roots`;
    finalizeFolder(folder);
    await computeReport();
    renderAll();
    setRootLabels();
    setStatus(`Loaded ${which}: ${folder.list.length} text files, ${folder.files.size} stored.`);
  }

  async function walkEntry(entry, prefix, folder, basePatterns, gitStack) {
    const queue = [{ entry, prefix, gitStack }];
    while (queue.length) {
      const { entry: en, prefix: pre, gitStack: gs } = queue.shift();
      if (en.isFile) {
        const f = await entryToFile(en);
        if (!f) continue;
        const fullPath = `${pre}/${f.name}`;
        const relPath = fullPath.includes("/") ? fullPath.split("/").slice(1).join("/") : fullPath;
        const eng = buildIgnoreEngine([...basePatterns, ...gs]);
        if (eng.shouldIgnore(relPath)) continue;
        const rec = await readAndClassify(f, fullPath, relPath);
        folder.files.set(fullPath, rec);
        if (rec.isText) folder.relIndex.set(relPath, fullPath);
        continue;
      }
      if (en.isDirectory) {
        const reader = en.createReader();
        const kids = await readAllEntries(reader);

        let nextStack = gs;
        const gi = kids.find(k => k.isFile && k.name === ".gitignore");
        if (gi) {
          const f = await entryToFile(gi);
          if (f) {
            try {
              const buf = await f.arrayBuffer();
              const txt = await decodeWithFallback(buf, state.encodingMode);
              const patterns = String(txt).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
              nextStack = [...nextStack, ...patterns];
            } catch {}
          }
        }
        for (const k of kids) {
          if (k.isDirectory) queue.push({ entry: k, prefix: `${pre}/${k.name}`, gitStack: nextStack });
          else if (k.isFile) queue.push({ entry: k, prefix: pre, gitStack: nextStack });
        }
      }
    }
  }

  function entryToFile(fileEntry) {
    return new Promise((resolve) => {
      try { fileEntry.file((f) => resolve(f), () => resolve(null)); }
      catch { resolve(null); }
    });
  }

  function readAllEntries(reader) {
    return new Promise((resolve, reject) => {
      const all = [];
      const read = () => reader.readEntries((entries) => {
        if (!entries?.length) return resolve(all);
        all.push(...entries);
        read();
      }, reject);
      read();
    });
  }

  function resetFolder(folder) {
    folder.loaded = false;
    folder.rootName = null;
    folder.files.clear();
    folder.relIndex.clear();
    folder.list = [];
    folder.shaToRel.clear();
  }

  function finalizeFolder(folder) {
    folder.loaded = true;
    folder.list = Array.from(folder.files.values()).filter(r => r.isText);
    folder.list.sort((a,b) => a.relPath.localeCompare(b.relPath));
    for (const r of folder.list) {
      if (!r.sha256) continue;
      const arr = folder.shaToRel.get(r.sha256) || [];
      arr.push(r.relPath);
      folder.shaToRel.set(r.sha256, arr);
    }
    updateMeta(folder.label);
  }

  function updateMeta(which) {
    const f = state[which];
    const total = f.files.size;
    const text = f.list.length;
    const non = total - text;
    const msg = `${f.rootName || "?"} • ${text} text • ${non} non-text • ${total} stored`;
    (which==="A" ? el.metaA : el.metaB).textContent = msg;
  }

  // --------- read/classify ---------
  function extOf(name) {
    const n = String(name||"").toLowerCase();
    if (n === "dockerfile") return "dockerfile";
    if (n === "makefile") return "makefile";
    if (n === ".gitignore") return "gitignore";
    const i = n.lastIndexOf(".");
    if (i<=0 || i===n.length-1) return "";
    return n.slice(i+1);
  }

  function isBinaryMime(mime) {
    const m = (mime||"").toLowerCase();
    return m.startsWith("image/") || m.startsWith("audio/") || m.startsWith("video/") ||
      m === "application/pdf" || m === "application/zip" || m === "application/octet-stream";
  }

  function hasNullBytes(buf) {
    const u8 = new Uint8Array(buf);
    const n = Math.min(u8.length, 4096);
    for (let i=0;i<n;i++) if (u8[i]===0) return true;
    return false;
  }

  async function readAndClassify(file, fullPath, relPath) {
    const rec = {
      fullPath, relPath,
      name: file.name || relPath.split("/").pop() || "unknown",
      ext: extOf(file.name),
      size: Number(file.size||0),
      mtime: file.lastModified ? new Date(file.lastModified).toISOString() : null,
      mime: file.type || "",
      isText: false,
      reasonSkipped: null,
      text: "",
      sha256: null
    };

    if (rec.ext && BIN_EXT_DENY.has(rec.ext)) { rec.reasonSkipped = `Skipped (binary ext .${rec.ext})`; return rec; }

    let buf;
    try { buf = await file.arrayBuffer(); }
    catch { rec.reasonSkipped = "Read error"; return rec; }

    if (rec.mime && isBinaryMime(rec.mime)) { rec.reasonSkipped = `Skipped (binary MIME ${rec.mime})`; return rec; }
    if (hasNullBytes(buf)) { rec.reasonSkipped = "Skipped (binary content)"; return rec; }

    const text = normalizeNewlines(await decodeWithFallback(buf, state.encodingMode));
    const repl = (text.match(/\uFFFD/g)||[]).length;
    const ratio = text.length ? (repl/text.length) : 0;

    const looksCode = CODEISH_EXT.has(rec.ext) || rec.ext==="" || rec.ext==="gitignore";
    if (ratio > 0.02 && !looksCode) { rec.reasonSkipped = "Skipped (decode quality poor)"; return rec; }

    rec.isText = true;
    rec.text = text;
    rec.sha256 = await sha256Hex(buf);
    return rec;
  }

  function normalizeNewlines(s) { return String(s).replace(/\r\n/g,"\n").replace(/\r/g,"\n"); }

  function detectUtf16(u8) {
    if (u8.length>=2) {
      if (u8[0]===0xFF && u8[1]===0xFE) return "utf-16le";
      if (u8[0]===0xFE && u8[1]===0xFF) return "utf-16be";
    }
    return null;
  }

  function decodeUtf16(u8, enc) {
    let start=0;
    if (u8.length>=2 && ((u8[0]===0xFF && u8[1]===0xFE) || (u8[0]===0xFE && u8[1]===0xFF))) start=2;
    const slice = u8.slice(start);
    if (enc==="utf-16le") return new TextDecoder("utf-16le",{fatal:false}).decode(slice);
    const swapped = new Uint8Array(slice.length);
    for (let i=0;i<slice.length-1;i+=2) { swapped[i]=slice[i+1]; swapped[i+1]=slice[i]; }
    return new TextDecoder("utf-16le",{fatal:false}).decode(swapped);
  }

  async function decodeWithFallback(buf, mode) {
    const u8 = new Uint8Array(buf);
    if (mode==="utf-8") return new TextDecoder("utf-8",{fatal:false}).decode(u8);
    if (mode==="windows-1252") return new TextDecoder("windows-1252",{fatal:false}).decode(u8);
    if (mode==="utf-16") {
      const enc = detectUtf16(u8);
      if (!enc) return new TextDecoder("utf-8",{fatal:false}).decode(u8);
      return decodeUtf16(u8, enc);
    }

    const enc = detectUtf16(u8);
    if (enc) return decodeUtf16(u8, enc);

    const utf8 = new TextDecoder("utf-8",{fatal:false}).decode(u8);
    const repl = (utf8.match(/\uFFFD/g)||[]).length;
    const ratio = utf8.length ? (repl/utf8.length) : 0;
    if (ratio > 0.02) return new TextDecoder("windows-1252",{fatal:false}).decode(u8);
    return utf8;
  }

  async function sha256Hex(buf) {
    const hash = await crypto.subtle.digest("SHA-256", buf);
    const bytes = new Uint8Array(hash);
    return Array.from(bytes).map(b => b.toString(16).padStart(2,"0")).join("");
  }

  // --------- report ---------
  async function computeReport() {
    if (!state.A.loaded || !state.B.loaded) { state.report = null; renderReport(); return; }
    const rels = new Set([...state.A.relIndex.keys(), ...state.B.relIndex.keys()]);
    const rows = [];
    const counts = { same:0, different:0, onlyA:0, onlyB:0, moved:0, total:0 };

    for (const rel of Array.from(rels).sort()) {
      const aFull = state.A.relIndex.get(rel) || null;
      const bFull = state.B.relIndex.get(rel) || null;
      const a = aFull ? state.A.files.get(aFull) : null;
      const b = bFull ? state.B.files.get(bFull) : null;

      let status="", movedFrom="", movedTo="";
      if (a && b) {
        if (a.sha256 && b.sha256 && a.sha256 === b.sha256) { status="same"; counts.same++; }
        else { status="different"; counts.different++; }
      } else if (a && !b) {
        const hits = a.sha256 ? (state.B.shaToRel.get(a.sha256)||[]) : [];
        if (hits.length) { status="moved"; counts.moved++; movedTo=hits[0]; }
        else { status="onlyA"; counts.onlyA++; }
      } else if (!a && b) {
        const hits = b.sha256 ? (state.A.shaToRel.get(b.sha256)||[]) : [];
        if (hits.length) { status="moved"; counts.moved++; movedFrom=hits[0]; }
        else { status="onlyB"; counts.onlyB++; }
      } else continue;

      rows.push({
        relPath: rel,
        status,
        aPath: a?.fullPath || "",
        bPath: b?.fullPath || "",
        aSha256: a?.sha256 || "",
        bSha256: b?.sha256 || "",
        aBytes: a?.size ?? "",
        bBytes: b?.size ?? "",
        movedFrom, movedTo
      });
    }
    counts.total = rows.length;
    state.report = {
      computedAt: new Date().toISOString(),
      roots: { A: state.A.rootName, B: state.B.rootName },
      counts, rows
    };
    renderReport();
  }

  function reportMap() {
    const m = new Map();
    for (const r of state.report?.rows || []) m.set(r.relPath, r);
    return m;
  }

  // --------- tree + selection ---------
  function renderTree(which) {
    const folder = state[which];
    const treeEl = which==="A" ? el.treeA : el.treeB;
    const q = (which==="A" ? el.searchA.value : el.searchB.value).trim().toLowerCase();
    const filter = which==="A" ? el.filterA.value : el.filterB.value;

    treeEl.innerHTML = "";
    if (!folder.loaded) { treeEl.innerHTML = `<div class="node dim"><span class="icon">⛔</span><span class="path">Not loaded</span></div>`; return; }

    const rep = reportMap();
    const active = which==="A" ? state.activeAPath : state.activeBPath;

    const items = folder.list.filter(rec => {
      if (q && !rec.relPath.toLowerCase().includes(q)) return false;
      if (filter==="text") return true;
      if (filter==="code") return CODEISH_EXT.has(rec.ext);
      const r = rep.get(rec.relPath);
      if (filter==="only") return which==="A" ? (r?.status==="onlyA") : (r?.status==="onlyB");
      if (filter==="diff") return r?.status==="different";
      if (filter==="same") return r?.status==="same";
      if (filter==="moved") return r?.status==="moved";
      return true;
    });

    for (const rec of items) {
      const badge = badgeFor(which, rec.relPath);
      const node = document.createElement("div");
      node.className = "node" + (active===rec.relPath ? " active":"");
      node.addEventListener("click", () => onSelect(which, rec.relPath));

      const icon = document.createElement("span"); icon.className="icon"; icon.textContent="📄";
      const path = document.createElement("span"); path.className="path"; path.textContent=rec.relPath;

      const b = document.createElement("span"); b.className="badge"; b.textContent=badge.text;
      b.style.borderColor = badge.border; b.style.color = badge.color;

      node.appendChild(icon); node.appendChild(path); node.appendChild(b);
      treeEl.appendChild(node);
    }
  }

  function onSelect(which, relPath) {
    if (which==="A") state.activeAPath = relPath; else state.activeBPath = relPath;

    if (state.linkSelections) {
      const other = which==="A" ? "B" : "A";
      if (state[other].relIndex.has(relPath)) {
        if (other==="A") state.activeAPath = relPath; else state.activeBPath = relPath;
      } else {
        const src = getSelectedRec(which);
        if (src?.sha256) {
          const hits = state[other].shaToRel.get(src.sha256) || [];
          if (hits.length) {
            if (other==="A") state.activeAPath = hits[0]; else state.activeBPath = hits[0];
          }
        }
      }
    }

    renderTree("A"); renderTree("B"); renderViewer();
  }

  function badgeFor(which, rel) {
    const r = (state.report?.rows || []).find(x => x.relPath === rel);
    if (!r) return { text:"Loaded", border:"rgba(155,176,198,.25)", color:"var(--muted)" };
    if (r.status==="same") return { text:"Same", border:"rgba(61,220,151,.35)", color:"rgba(61,220,151,.95)" };
    if (r.status==="different") return { text:"Diff", border:"rgba(255,204,102,.35)", color:"rgba(255,204,102,.95)" };
    if (r.status==="onlyA") return which==="A" ? { text:"Only A", border:"rgba(255,92,122,.35)", color:"rgba(255,92,122,.95)" } : { text:"Missing", border:"rgba(155,176,198,.25)", color:"var(--muted)" };
    if (r.status==="onlyB") return which==="B" ? { text:"Only B", border:"rgba(255,92,122,.35)", color:"rgba(255,92,122,.95)" } : { text:"Missing", border:"rgba(155,176,198,.25)", color:"var(--muted)" };
    if (r.status==="moved") return { text:"Moved", border:"rgba(125,108,255,.50)", color:"rgba(125,108,255,.95)" };
    return { text:r.status, border:"rgba(155,176,198,.25)", color:"var(--muted)" };
  }

  // --------- viewer + similarity + diff ---------
  function renderViewer() {
    const relA = state.activeAPath, relB = state.activeBPath;
    el.activePath.textContent = `A: ${relA || "—"}   |   B: ${relB || "—"}`;

    const a = getSelectedRec("A");
    const b = getSelectedRec("B");

    el.activeMeta.textContent = `A: ${a?.isText ? fmtBytes(a.size)+" • sha "+shortSha(a.sha256) : "missing"}  |  B: ${b?.isText ? fmtBytes(b.size)+" • sha "+shortSha(b.sha256) : "missing"}`;

    const fullA = a?.isText ? a.text : "";
    const fullB = b?.isText ? b.text : "";
    const viewA = state.expanded ? fullA : preview(fullA);
    const viewB = state.expanded ? fullB : preview(fullB);

    el.hintA.textContent = hintPreview(fullA);
    el.hintB.textContent = hintPreview(fullB);

    renderSimilarity(a, b);

    if (!state.diffEnabled) {
      el.paneWrap.classList.remove("hidden");
      el.inlineWrap.classList.add("hidden");
      el.codeA.textContent = viewA;
      el.codeB.textContent = viewB;
      el.codeInline.textContent = "";
      el.hintInline.textContent = "";
      return;
    }

    const canDiff = !!(a?.isText && b?.isText);
    if (!canDiff) {
      el.paneWrap.classList.remove("hidden");
      el.inlineWrap.classList.add("hidden");
      el.codeA.textContent = viewA;
      el.codeB.textContent = viewB;
      setStatus("Diff mode: select a text file on both sides.");
      return;
    }

    if (state.diffLayout === "inline") {
      el.paneWrap.classList.add("hidden");
      el.inlineWrap.classList.remove("hidden");
      el.hintInline.textContent = state.expanded ? "" : "Preview diff (Expand for full)";
      el.codeInline.innerHTML = inlineDiffHTML(viewA, viewB);
    } else {
      el.paneWrap.classList.remove("hidden");
      el.inlineWrap.classList.add("hidden");
      const { leftHTML, rightHTML } = sideDiffHTML(viewA, viewB);
      el.codeA.innerHTML = leftHTML;
      el.codeB.innerHTML = rightHTML;
    }
  }

  function getSelectedRec(which) {
    const rel = which==="A" ? state.activeAPath : state.activeBPath;
    if (!rel) return null;
    const full = state[which].relIndex.get(rel) || null;
    return full ? state[which].files.get(full) : null;
  }

  function preview(t) {
    if (!t) return "";
    if (t.length <= PREVIEW_CHARS) return t;
    return t.slice(0, PREVIEW_CHARS) + "\n\n[... PREVIEW TRUNCATED ... click Expand for full ...]\n";
  }
  function hintPreview(t) { return (!t || t.length<=PREVIEW_CHARS) ? "" : `Previewing ${PREVIEW_CHARS.toLocaleString()} of ${t.length.toLocaleString()} chars`; }
  function shortSha(s){ return s ? s.slice(0,8) : "n/a"; }
  function fmtBytes(n){ if (n<1024) return `${n} B`; if (n<1024*1024) return `${(n/1024).toFixed(1)} KB`; return `${(n/(1024*1024)).toFixed(2)} MB`; }

  function renderSimilarity(a, b) {
    el.similarityGrid.innerHTML = "";
    el.suggestions.innerHTML = "";
    if (!a?.isText || !b?.isText) { el.similarityMeta.textContent = "Select any text file in A and any text file in B."; return; }

    const sameHash = !!(a.sha256 && b.sha256 && a.sha256 === b.sha256);
    const nameSim = stringSimilarity(a.relPath, b.relPath);
    const extMatch = !!(a.ext && b.ext && a.ext===b.ext);
    const contentSim = contentSimilarity(a.text, b.text);
    const overall = clamp01(contentSim*0.78 + nameSim*0.22);

    el.similarityMeta.textContent = sameHash ? "Exact match (SHA-256 identical)." : "Scored similarity for the selected pair.";

    const cards = [
      {k:"Overall", v:pct(overall), cls: overall>=0.9?"good":(overall>=0.7?"warn":"bad")},
      {k:"Content", v:pct(contentSim), cls: contentSim>=0.9?"good":(contentSim>=0.7?"warn":"bad")},
      {k:"Path/name", v:pct(nameSim), cls: nameSim>=0.9?"good":(nameSim>=0.7?"warn":"bad")},
      {k:"SHA-256", v: sameHash ? "YES":"NO", cls: sameHash?"good":"bad"},
      {k:"Ext match", v: extMatch ? "YES":"NO", cls: extMatch?"good":""},
      {k:"Bytes A/B", v: `${a.size.toLocaleString()} / ${b.size.toLocaleString()}`, cls:""}
    ];
    for (const it of cards) {
      const d = document.createElement("div");
      d.className = "kpi " + (it.cls||"");
      d.innerHTML = `<div class="k">${it.k}</div><div class="v">${it.v}</div>`;
      el.similarityGrid.appendChild(d);
    }
  }

  function pct(x){ return `${Math.round(clamp01(x)*100)}%`; }
  function clamp01(x){ return Math.max(0, Math.min(1, x)); }

  function contentSimilarity(aText, bText) {
    const A = shingleSet(aText);
    const B = shingleSet(bText);
    if (A.size===0 && B.size===0) return 1;
    if (A.size===0 || B.size===0) return 0;
    let inter=0;
    for (const k of A) if (B.has(k)) inter++;
    const union = A.size + B.size - inter;
    return union ? (inter/union) : 0;
  }

  function shingleSet(text) {
    const t = String(text||"").replace(/\s+/g," ").trim();
    if (!t) return new Set();
    const maxChars = 400_000; // scoring window (not viewer cap)
    const s = t.length>maxChars ? t.slice(0,maxChars) : t;
    const set = new Set();
    const base = 257;
    let h=0;
    for (let i=0;i<s.length;i++){
      h = ((h*base) + s.charCodeAt(i)) >>> 0;
      if (i>=2) set.add(h);
    }
    if (set.size>200_000){
      const out = new Set();
      let i=0; for (const v of set){ if ((i++%3)===0) out.add(v); }
      return out;
    }
    return set;
  }

  function stringSimilarity(a,b){
    const A=String(a||""), B=String(b||"");
    if (!A && !B) return 1;
    if (!A || !B) return 0;
    const dist = levenshtein(A,B);
    const maxLen = Math.max(A.length,B.length);
    return maxLen ? (1 - dist/maxLen) : 0;
  }

  function levenshtein(a,b){
    const n=a.length, m=b.length;
    if (n===0) return m;
    if (m===0) return n;
    const v0 = new Uint32Array(m+1);
    const v1 = new Uint32Array(m+1);
    for (let j=0;j<=m;j++) v0[j]=j;
    for (let i=0;i<n;i++){
      v1[0]=i+1;
      const ca=a.charCodeAt(i);
      for (let j=0;j<m;j++){
        const cb=b.charCodeAt(j);
        const cost = (ca===cb)?0:1;
        const del = v0[j+1]+1;
        const ins = v1[j]+1;
        const sub = v0[j]+cost;
        v1[j+1]=Math.min(del,ins,sub);
      }
      v0.set(v1);
    }
    return v0[m];
  }

  // --------- suggestions ---------
  async function suggestMatch(fromSide){
    const srcSide=fromSide;
    const dstSide=fromSide==="A" ? "B" : "A";
    const src = getSelectedRec(srcSide);
    if (!src?.isText) { setStatus(`Suggest: select a text file in ${srcSide}.`); return; }
    if (!state[dstSide].loaded) { setStatus(`Suggest: load folder ${dstSide} first.`); return; }

    setStatus(`Suggesting match for ${srcSide} -> ${dstSide} ...`);

    const dstFolder = state[dstSide];

    // 1) exact hash match
    const exact = src.sha256 ? (dstFolder.shaToRel.get(src.sha256) || []) : [];
    if (exact.length){
      renderSuggestions(dstSide, exact.slice(0,SUGGEST_TOP).map(p => ({relPath:p, score:1.0, reason:"Exact SHA-256 match"})));
      setStatus(`Suggest: found exact content match (${exact.length} hit(s)).`);
      return;
    }

    // 2) shortlist by filename similarity (same ext when possible)
    const srcExt = src.ext || "";
    const scored = [];
    for (const cand of dstFolder.list){
      if (!cand.isText) continue;
      if (srcExt && cand.ext && cand.ext !== srcExt) continue;
      const nameSim = stringSimilarity(src.relPath, cand.relPath);
      const baseSim = stringSimilarity(basename(src.relPath), basename(cand.relPath));
      const quick = clamp01(nameSim*0.6 + baseSim*0.4);
      scored.push({cand, quick});
    }
    scored.sort((x,y)=>y.quick-x.quick);
    const shortlist = scored.slice(0, Math.min(SUGGEST_MAX_FILENAME_CANDIDATES, scored.length));

    // 3) content similarity ranking for shortlist
    const final = [];
    for (const it of shortlist){
      const cand = it.cand;
      const contentSim = contentSimilarity(src.text, cand.text);
      const nameSim = stringSimilarity(src.relPath, cand.relPath);
      const overall = clamp01(contentSim*0.78 + nameSim*0.22);
      final.push({relPath:cand.relPath, score:overall, reason:`content ${Math.round(contentSim*100)}% + name ${Math.round(nameSim*100)}%`});
    }
    final.sort((a,b)=>b.score-a.score);
    renderSuggestions(dstSide, final.slice(0,SUGGEST_TOP));
    setStatus(`Suggest: ranked ${final.length} candidates (showing top ${Math.min(SUGGEST_TOP, final.length)}).`);
  }

  function basename(p){
    const s=String(p||"").replaceAll("\\","/");
    const i=s.lastIndexOf("/");
    return i>=0 ? s.slice(i+1) : s;
  }

  function renderSuggestions(dstSide, items){
    el.suggestions.innerHTML = "";
    if (!items?.length) return;

    const head = document.createElement("div");
    head.className = "sughead";
    head.innerHTML = `<div>Suggestions (click Apply to select in ${dstSide})</div><div class="mono">Top ${items.length}</div>`;
    el.suggestions.appendChild(head);

    const list = document.createElement("div");
    list.className = "suglist";

    for (const it of items){
      const row = document.createElement("div");
      row.className = "sugitem";

      const p = document.createElement("div");
      p.className = "sugpath";
      p.textContent = it.relPath;

      const s = document.createElement("div");
      s.className = "sugscore";
      s.textContent = `${Math.round(clamp01(it.score)*100)}% • ${it.reason}`;

      const b = document.createElement("button");
      b.className = "sugbtn";
      b.textContent = "Apply";
      b.addEventListener("click", () => {
        if (dstSide==="A") state.activeAPath = it.relPath;
        else state.activeBPath = it.relPath;
        renderTree("A"); renderTree("B"); renderViewer();
      });

      row.appendChild(p); row.appendChild(s); row.appendChild(b);
      list.appendChild(row);
    }
    el.suggestions.appendChild(list);
  }

  // --------- diff ---------
  function diffLines(aText, bText){
    const A=aText.split("\n"), B=bText.split("\n");
    const n=A.length, m=B.length;
    const dir = Array.from({length:n+1}, ()=> new Uint8Array(m+1));
    let prev = new Uint32Array(m+1);
    let curr = new Uint32Array(m+1);

    for (let i=1;i<=n;i++){
      curr.fill(0);
      for (let j=1;j<=m;j++){
        if (A[i-1]===B[j-1]) { curr[j]=prev[j-1]+1; dir[i][j]=0; }
        else if (prev[j] >= curr[j-1]) { curr[j]=prev[j]; dir[i][j]=1; }
        else { curr[j]=curr[j-1]; dir[i][j]=2; }
      }
      const tmp=prev; prev=curr; curr=tmp;
    }

    let i=n, j=m;
    const ops=[];
    while (i>0 || j>0){
      if (i>0 && j>0 && dir[i][j]===0) { ops.push({t:"eq", a:A[i-1], b:B[j-1]}); i--; j--; }
      else if (i>0 && (j===0 || dir[i][j]===1)) { ops.push({t:"del", a:A[i-1], b:""}); i--; }
      else { ops.push({t:"add", a:"", b:B[j-1]}); j--; }
    }
    ops.reverse();
    return coalesce(ops);
  }

  function coalesce(ops){
    const out=[];
    let k=0;
    while (k<ops.length){
      const op=ops[k];
      if (op.t==="del"){
        const dels=[];
        while (k<ops.length && ops[k].t==="del"){ dels.push(ops[k]); k++; }
        const adds=[];
        let kk=k;
        while (kk<ops.length && ops[kk].t==="add"){ adds.push(ops[kk]); kk++; }
        if (adds.length){
          const max=Math.max(dels.length, adds.length);
          for (let i=0;i<max;i++) out.push({t:"chg", a:dels[i]?.a ?? "", b:adds[i]?.b ?? ""});
          k=kk;
        } else out.push(...dels);
      } else { out.push(op); k++; }
    }
    return out;
  }

  function esc(s){ return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }

  function inlineDiffHTML(aText,bText){
    const ops=diffLines(aText,bText);
    const lines=[];
    for (const op of ops){
      if (op.t==="eq") lines.push(`<span class="line">${esc(op.a)}</span>`);
      else if (op.t==="add") lines.push(`<span class="line add">+ ${esc(op.b)}</span>`);
      else if (op.t==="del") lines.push(`<span class="line del">- ${esc(op.a)}</span>`);
      else { lines.push(`<span class="line del">- ${esc(op.a)}</span>`); lines.push(`<span class="line add">+ ${esc(op.b)}</span>`); }
    }
    return lines.join("\n");
  }

  function sideDiffHTML(aText,bText){
    const ops=diffLines(aText,bText);
    const left=[], right=[];
    for (const op of ops){
      if (op.t==="eq"){ left.push(`<span class="line">${esc(op.a)}</span>`); right.push(`<span class="line">${esc(op.b)}</span>`); }
      else if (op.t==="add"){ left.push(`<span class="line dim"></span>`); right.push(`<span class="line add">${esc(op.b)}</span>`); }
      else if (op.t==="del"){ left.push(`<span class="line del">${esc(op.a)}</span>`); right.push(`<span class="line dim"></span>`); }
      else { left.push(`<span class="line chg">${esc(op.a)}</span>`); right.push(`<span class="line chg">${esc(op.b)}</span>`); }
    }
    return { leftHTML:left.join("\n"), rightHTML:right.join("\n") };
  }

  // --------- report render + export ---------
  function renderReport(){
    if (!state.report){ el.reportMeta.textContent="Load both folders to compute."; el.reportGrid.innerHTML=""; return; }
    const c=state.report.counts;
    el.reportMeta.textContent = `Computed ${state.report.computedAt} • Total compared: ${c.total}`;
    el.reportGrid.innerHTML="";
    const cards=[
      {k:"Same",v:c.same,cls:"good"},
      {k:"Different",v:c.different,cls:"warn"},
      {k:"Only A",v:c.onlyA,cls:"bad"},
      {k:"Only B",v:c.onlyB,cls:"bad"},
      {k:"Moved/Renamed",v:c.moved,cls:""},
      {k:"Total",v:c.total,cls:""}
    ];
    for (const it of cards){
      const d=document.createElement("div");
      d.className="kpi "+(it.cls||"");
      d.innerHTML=`<div class="k">${it.k}</div><div class="v">${Number(it.v).toLocaleString()}</div>`;
      el.reportGrid.appendChild(d);
    }
  }

  function exportReport(fmt){
    if (!state.report){ setStatus("No report yet. Load both folders."); return; }
    const stamp = new Date().toISOString().replaceAll(":","-").replaceAll(".","-");
    if (fmt==="json"){ dl(`comparison_report_${stamp}.json`, JSON.stringify(state.report,null,2), "application/json"); setStatus("Exported report JSON."); return; }
    if (fmt==="csv"){
      const cols=["relPath","status","aPath","bPath","aSha256","bSha256","aBytes","bBytes","movedFrom","movedTo"];
      const lines=[cols.join(",")];
      for (const r of state.report.rows) lines.push(cols.map(c => csv(r[c] ?? "")).join(","));
      dl(`comparison_report_${stamp}.csv`, lines.join("\n"), "text/csv"); setStatus("Exported report CSV."); return;
    }
  }

  function csv(v){ const s=String(v ?? ""); return (/[\\"",\n]/.test(s)) ? `"${s.replaceAll('"','""')}"` : s; }

  // --------- bundle export ---------
  function exportBundle(which){
    const stamp=new Date().toISOString().replaceAll(":","-").replaceAll(".","-");
    const outputs=[];
    const manifests=[];

    if (which==="A" || which==="both"){
      const out=buildBundle(state.A,"A");
      outputs.push({name:`bundle_A_${stamp}.txt`,text:out.bundle});
      manifests.push({side:"A",manifest:out.manifest});
    }
    if (which==="B" || which==="both"){
      const out=buildBundle(state.B,"B");
      outputs.push({name:`bundle_B_${stamp}.txt`,text:out.bundle});
      manifests.push({side:"B",manifest:out.manifest});
    }
    if (which==="both" && state.A.loaded && state.B.loaded){
      const out=buildCombinedBundle();
      outputs.push({name:`bundle_AB_${stamp}.txt`,text:out.bundle});
      manifests.push({side:"AB",manifest:out.manifest});
    }

    for (const o of outputs) dl(o.name,o.text,"text/plain");
    dl(`index_manifest_${stamp}.json`, JSON.stringify({
      createdAt: new Date().toISOString(),
      tool: "ui/folder_reader",
      roots: {A: state.A.rootName, B: state.B.rootName},
      manifests
    },null,2), "application/json");

    setStatus("Exported bundle(s) + index manifest.");
  }

  function buildBundle(folder,label){
    if (!folder.loaded) return {bundle:`# ${label} not loaded\n`, manifest:[]};
    const header=[
      `# BUNDLE: ${label}`,
      `# ROOT: ${folder.rootName || ""}`,
      `# CREATED_AT: ${new Date().toISOString()}`,
      `# DEFAULT_IGNORE: ${DEFAULT_IGNORE.join(" ; ")}`,
      `# CUSTOM_IGNORE_LINES:`,
      ...getCustomIgnorePatterns().map(x => `#   ${x}`),
      "",""
    ].join("\n");

    const parts=[];
    const manifest=[];

    for (const rec of folder.list){
      parts.push("===== FILE START =====");
      parts.push(`PATH: ${rec.relPath}`);
      parts.push(`FULLPATH: ${rec.fullPath}`);
      parts.push(`BYTES: ${rec.size}`);
      parts.push(`MTIME: ${rec.mtime || ""}`);
      parts.push(`SHA256: ${rec.sha256 || ""}`);
      parts.push("===== CONTENT =====");
      parts.push(rec.text || "");
      parts.push("===== FILE END =====");
      parts.push("");
      manifest.push({relPath:rec.relPath, fullPath:rec.fullPath, bytes:rec.size, mtime:rec.mtime, sha256:rec.sha256});
    }
    return {bundle:header + parts.join("\n"), manifest};
  }

  function buildCombinedBundle(){
    const rows=state.report?.rows || [];
    const parts=[
      "# BUNDLE: AB",
      `# ROOT_A: ${state.A.rootName || ""}`,
      `# ROOT_B: ${state.B.rootName || ""}`,
      `# CREATED_AT: ${new Date().toISOString()}`,
      ""
    ];
    const manifest=[];

    for (const r of rows){
      const rel=r.relPath;
      const aFull=state.A.relIndex.get(rel) || null;
      const bFull=state.B.relIndex.get(rel) || null;
      const a=aFull ? state.A.files.get(aFull) : null;
      const b=bFull ? state.B.files.get(bFull) : null;

      parts.push("===== PAIR START =====");
      parts.push(`REL_PATH: ${rel}`);
      parts.push(`STATUS: ${r.status}`);
      parts.push(`A_FULLPATH: ${r.aPath}`);
      parts.push(`B_FULLPATH: ${r.bPath}`);
      parts.push(`A_SHA256: ${r.aSha256}`);
      parts.push(`B_SHA256: ${r.bSha256}`);
      if (r.movedFrom) parts.push(`MOVED_FROM: ${r.movedFrom}`);
      if (r.movedTo) parts.push(`MOVED_TO: ${r.movedTo}`);
      parts.push("===== A CONTENT ====="); parts.push(a?.isText ? a.text : "");
      parts.push("===== B CONTENT ====="); parts.push(b?.isText ? b.text : "");
      parts.push("===== PAIR END ====="); parts.push("");

      manifest.push({
        relPath: rel, status: r.status,
        a: a?.isText ? {fullPath:a.fullPath, sha256:a.sha256, bytes:a.size, mtime:a.mtime} : null,
        b: b?.isText ? {fullPath:b.fullPath, sha256:b.sha256, bytes:b.size, mtime:b.mtime} : null,
        movedFrom: r.movedFrom || null,
        movedTo: r.movedTo || null
      });
    }
    return {bundle:parts.join("\n"), manifest};
  }

  // --------- copy ---------
  function getCopyText(){
    const a=getSelectedRec("A");
    const b=getSelectedRec("B");
    const relA=state.activeAPath || "—";
    const relB=state.activeBPath || "—";
    const A=a?.isText ? (state.expanded ? a.text : preview(a.text)) : "[missing]";
    const B=b?.isText ? (state.expanded ? b.text : preview(b.text)) : "[missing]";

    if (!state.diffEnabled || !a?.isText || !b?.isText) return `### Manual Compare\nA: ${relA}\nB: ${relB}\n\n--- A ---\n${A}\n\n--- B ---\n${B}\n`;

    if (state.diffLayout==="inline"){
      const ops=diffLines(A,B);
      const lines=[];
      for (const op of ops){
        if (op.t==="eq") lines.push(`  ${op.a}`);
        else if (op.t==="add") lines.push(`+ ${op.b}`);
        else if (op.t==="del") lines.push(`- ${op.a}`);
        else { lines.push(`- ${op.a}`); lines.push(`+ ${op.b}`); }
      }
      return `### Manual Compare Diff (inline)\nA: ${relA}\nB: ${relB}\n\n` + lines.join("\n") + "\n";
    }
    return `### Manual Compare\nA: ${relA}\nB: ${relB}\n\n--- A ---\n${A}\n\n--- B ---\n${B}\n`;
  }

  // --------- clear/render/util ---------
  function clearAll(){
    state.A=makeFolderState("A");
    state.B=makeFolderState("B");
    state.report=null;
    state.activeAPath=null;
    state.activeBPath=null;
    state.diffEnabled=false;
    state.diffLayout="side";
    state.expanded=false;
    state.linkSelections=false;

    el.toggleDiff.checked=false;
    el.diffMode.value="side";
    el.toggleLink.checked=false;
    el.btnExpand.textContent="Expand";

    el.searchA.value=""; el.searchB.value="";
    el.filterA.value="all"; el.filterB.value="all";
    el.metaA.textContent="Not loaded"; el.metaB.textContent="Not loaded";
    el.treeA.innerHTML=""; el.treeB.innerHTML="";
    el.activePath.textContent="A: —  |  B: —";
    el.activeMeta.textContent="";
    el.codeA.textContent=""; el.codeB.textContent=""; el.codeInline.textContent="";
    el.hintA.textContent=""; el.hintB.textContent=""; el.hintInline.textContent="";
    el.similarityMeta.textContent="Select any file in A and any file in B.";
    el.similarityGrid.innerHTML=""; el.suggestions.innerHTML="";
    renderReport();
    setStatus("Cleared.");
  }

  function renderAll(){
    updateMeta("A"); updateMeta("B");
    renderTree("A"); renderTree("B");
    renderViewer(); renderReport();
  }

  function dl(name, text, mime){
    const blob=new Blob([text], {type: mime || "text/plain;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=name;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function setStatus(msg){ el.statusbar.textContent=msg; console.log(`[folder_reader] ${msg}`); }


  // -------------------------
  // Pack Merge (v5)
  // -------------------------
  state.packs = []; // [{id, source, rootName, subfolder, files:[{path, sha256, bytes, mtime, text}]}]

  const packEl = {
    subfolder: document.getElementById("packSubfolder"),
    side: document.getElementById("packSide"),
    btnList: document.getElementById("btnListSubfolders"),
    btnUseA: document.getElementById("btnUseSelectedA"),
    btnUseB: document.getElementById("btnUseSelectedB"),
    btnAddLoaded: document.getElementById("btnAddPackFromLoaded"),
    pickFolder: document.getElementById("pickPackFolder"),
    list: document.getElementById("packList"),
    btnMerge: document.getElementById("btnMergePacks"),
    btnClear: document.getElementById("btnClearPacks"),
  };

  if (packEl.subfolder) {
    packEl.btnList?.addEventListener("click", () => {
      const side = (packEl.side?.value || "A");
      const folders = listSubfolders(side);
      renderPackSuggestions(folders.slice(0, 200));
      setStatus(`Found ${folders.length.toLocaleString()} subfolder paths in ${side}.`);
    });

    packEl.btnUseA?.addEventListener("click", () => {
      const p = deriveSelectedFolderPath("A");
      if (p) packEl.subfolder.value = p;
      setStatus(p ? `Subfolder set from selected A: ${p}` : "Select a file in A first.");
    });

    packEl.btnUseB?.addEventListener("click", () => {
      const p = deriveSelectedFolderPath("B");
      if (p) packEl.subfolder.value = p;
      setStatus(p ? `Subfolder set from selected B: ${p}` : "Select a file in B first.");
    });

    packEl.btnAddLoaded?.addEventListener("click", async () => {
      const side = (packEl.side?.value || "A");
      const sub = normalizeSubfolder(packEl.subfolder.value);
      if (!sub) { setStatus("Pack: enter a subfolder path first."); return; }
      if (!state[side].loaded) { setStatus(`Pack: load folder ${side} first.`); return; }
      const pack = buildPackFromLoaded(side, sub);
      if (!pack.files.length) { setStatus(`Pack: no text files found under "${sub}" in ${side}.`); return; }
      state.packs.push(pack);
      renderPacks();
      setStatus(`Added pack from loaded ${side}: ${pack.files.length} files.`);
    });

    packEl.pickFolder?.addEventListener("change", async () => {
      const sub = normalizeSubfolder(packEl.subfolder.value);
      if (!sub) { setStatus("Pack: enter a subfolder path first."); packEl.pickFolder.value=""; return; }
      const files = Array.from(packEl.pickFolder.files || []);
      if (!files.length) return;

      setStatus(`Pack: loading uploaded folder selection (${files.length} items) ...`);
      const temp = await loadTempFolderFromWebkit(files);
      const pack = buildPackFromTemp(temp, sub);
      if (!pack.files.length) { setStatus(`Pack: no text files found under "${sub}" in uploaded selection.`); packEl.pickFolder.value=""; return; }
      state.packs.push(pack);
      renderPacks();
      setStatus(`Added pack from upload: ${pack.files.length} files.`);
      packEl.pickFolder.value = "";
    });

    packEl.btnMerge?.addEventListener("click", () => {
      if (!state.packs.length) { setStatus("Merge: add at least one pack first."); return; }
      const merged = mergePacks(state.packs);
      exportMergedPack(merged);
      setStatus(`Merged ${state.packs.length} pack(s): ${merged.files.length} output file(s).`);
    });

    packEl.btnClear?.addEventListener("click", () => {
      state.packs = [];
      renderPacks();
      setStatus("Cleared packs.");
    });

    renderPacks();
  }

  function normalizeSubfolder(s) {
    const v = String(s || "").trim().replaceAll("\\", "/");
    if (!v) return "";
    return v.replace(/^\/+/, "").replace(/\/+$/, "");
  }

  function deriveSelectedFolderPath(side) {
    const rel = (side === "A" ? state.activeAPath : state.activeBPath) || "";
    if (!rel) return "";
    const parts = rel.split("/");
    if (parts.length <= 1) return "";
    parts.pop();
    return parts.join("/");
  }

  function listSubfolders(side) {
    const folder = state[side];
    if (!folder.loaded) return [];
    const set = new Set();
    for (const rec of folder.list) {
      const parts = rec.relPath.split("/");
      let acc = "";
      for (let i = 0; i < parts.length - 1; i++) {
        acc = acc ? (acc + "/" + parts[i]) : parts[i];
        set.add(acc);
      }
    }
    return Array.from(set).sort((a,b) => a.localeCompare(b));
  }

  function renderPackSuggestions(items) {
    if (!el.suggestions) return;
    el.suggestions.innerHTML = "";
    const head = document.createElement("div");
    head.className = "sughead";
    head.innerHTML = `<div>Subfolder paths (click to fill)</div><div class="mono">Top ${items.length}</div>`;
    el.suggestions.appendChild(head);

    const list = document.createElement("div");
    list.className = "suglist";
    for (const p of items) {
      const row = document.createElement("div");
      row.className = "sugitem";
      const path = document.createElement("div");
      path.className = "sugpath";
      path.textContent = p;
      const btn = document.createElement("button");
      btn.className = "sugbtn";
      btn.textContent = "Use";
      btn.addEventListener("click", () => {
        packEl.subfolder.value = p;
        setStatus(`Subfolder set: ${p}`);
      });
      const score = document.createElement("div");
      score.className = "sugscore";
      score.textContent = "subfolder";
      row.appendChild(path);
      row.appendChild(score);
      row.appendChild(btn);
      list.appendChild(row);
    }
    el.suggestions.appendChild(list);
  }

  function newPackId() {
    return "pack_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
  }

  function buildPackFromLoaded(side, subfolder) {
    const folder = state[side];
    const sub = subfolder;
    const files = [];
    for (const rec of folder.list) {
      if (rec.relPath === sub || rec.relPath.startsWith(sub + "/")) {
        files.push({
          path: rec.relPath,
          sha256: rec.sha256 || "",
          bytes: rec.size || 0,
          mtime: rec.mtime || "",
          text: rec.text || ""
        });
      }
    }
    return {
      id: newPackId(),
      source: `loaded-${side}`,
      rootName: folder.rootName || "",
      subfolder: sub,
      createdAt: new Date().toISOString(),
      files
    };
  }

  async function loadTempFolderFromWebkit(fileList) {
    const files = Array.from(fileList || []);
    const rootName = inferRootFromWebkit(files) || "UploadedFolder";
    const basePatterns = [...DEFAULT_IGNORE, ...getCustomIgnorePatterns()];
    const gitignoreMap = await buildGitignoreMapFromWebkit(files);

    const ignoreForPath = (relPath) => {
      const patterns = [...basePatterns, ...collectGitignorePatterns(relPath, gitignoreMap)];
      return buildIgnoreEngine(patterns);
    };

    const temp = { rootName, list: [] };
    for (const f of files) {
      const rel = (f.webkitRelativePath || f.name).replaceAll("\\", "/");
      if (ignoreForPath(rel).shouldIgnore(rel)) continue;
      const fullPath = `${rootName}/${rel}`;
      const rec = await readAndClassify(f, fullPath, rel);
      if (rec.isText) temp.list.push(rec);
    }
    temp.list.sort((a,b) => a.relPath.localeCompare(b.relPath));
    return temp;
  }

  function buildPackFromTemp(temp, subfolder) {
    const sub = subfolder;
    const files = [];
    for (const rec of temp.list) {
      if (rec.relPath === sub || rec.relPath.startsWith(sub + "/")) {
        files.push({
          path: rec.relPath,
          sha256: rec.sha256 || "",
          bytes: rec.size || 0,
          mtime: rec.mtime || "",
          text: rec.text || ""
        });
      }
    }
    return {
      id: newPackId(),
      source: `upload`,
      rootName: temp.rootName || "",
      subfolder: sub,
      createdAt: new Date().toISOString(),
      files
    };
  }

  function renderPacks() {
    if (!packEl.list) return;
    packEl.list.innerHTML = "";
    if (!state.packs.length) {
      packEl.list.innerHTML = `<div class="node dim"><span class="icon">🧩</span><span class="path">No packs yet</span></div>`;
      return;
    }

    state.packs.forEach((p, idx) => {
      const item = document.createElement("div");
      item.className = "packitem";

      const meta = document.createElement("div");
      meta.className = "packmeta";
      meta.innerHTML = `
        <div class="packname">Pack ${idx+1} • ${escapeHtml(p.subfolder)}</div>
        <div class="packdesc">Source: ${escapeHtml(p.source)} • Root: ${escapeHtml(p.rootName)} • Files: ${p.files.length.toLocaleString()}</div>
      `;

      const actions = document.createElement("div");
      actions.className = "packactions";

      const del = document.createElement("button");
      del.className = "packbtn";
      del.textContent = "Remove";
      del.addEventListener("click", () => {
        state.packs = state.packs.filter(x => x.id !== p.id);
        renderPacks();
        setStatus("Removed pack.");
      });

      const dlbtn = document.createElement("button");
      dlbtn.className = "packbtn";
      dlbtn.textContent = "Export this pack";
      dlbtn.addEventListener("click", () => {
        const merged = mergePacks([p]);
        exportMergedPack(merged, `pack_${idx+1}`);
        setStatus("Exported pack.");
      });

      actions.appendChild(dlbtn);
      actions.appendChild(del);

      item.appendChild(meta);
      item.appendChild(actions);
      packEl.list.appendChild(item);
    });
  }

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  }

  function mergePacks(packs) {
    const byPath = new Map(); // path -> Map(sha -> fileObj)
    const collisions = [];

    for (const pk of packs) {
      for (const f of pk.files) {
        const path = f.path;
        const sha = f.sha256 || "";
        if (!byPath.has(path)) byPath.set(path, new Map());
        const m = byPath.get(path);
        if (!m.has(sha)) {
          m.set(sha, { ...f, origins: [{ packId: pk.id, source: pk.source, rootName: pk.rootName, subfolder: pk.subfolder }] });
        } else {
          const existing = m.get(sha);
          existing.origins.push({ packId: pk.id, source: pk.source, rootName: pk.rootName, subfolder: pk.subfolder });
        }
      }
    }

    const outFiles = [];
    for (const [path, shaMap] of byPath.entries()) {
      const variants = Array.from(shaMap.values());
      if (variants.length === 1) {
        const v = variants[0];
        outFiles.push({ outPath: path, variantOf: "", ...v });
      } else {
        collisions.push({ path, variantCount: variants.length, shas: variants.map(v => v.sha256) });
        variants.sort((a,b) => String(a.sha256).localeCompare(String(b.sha256)));
        outFiles.push({ outPath: path, variantOf: "", ...variants[0] });
        for (let i = 1; i < variants.length; i++) {
          const v = variants[i];
          const outPath = addVariantSuffix(path, i+1, v.sha256);
          outFiles.push({ outPath, variantOf: path, ...v });
        }
      }
    }

    outFiles.sort((a,b) => a.outPath.localeCompare(b.outPath));

    return {
      createdAt: new Date().toISOString(),
      packs: packs.map(p => ({ id:p.id, source:p.source, rootName:p.rootName, subfolder:p.subfolder, createdAt:p.createdAt, fileCount:p.files.length })),
      collisions,
      files: outFiles
    };
  }

  function addVariantSuffix(path, n, sha) {
    const short = (sha || "nosha").slice(0, 8);
    const p = String(path);
    const i = p.lastIndexOf("/");
    const dir = i >= 0 ? p.slice(0, i+1) : "";
    const base = i >= 0 ? p.slice(i+1) : p;
    const dot = base.lastIndexOf(".");
    if (dot > 0) {
      const name = base.slice(0, dot);
      const ext = base.slice(dot);
      return `${dir}${name}__v${n}__${short}${ext}`;
    }
    return `${dir}${base}__v${n}__${short}`;
  }

  function exportMergedPack(merged, label="merged") {
    const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
    const bundleName = `merged_${label}_${stamp}.txt`;
    const manifestName = `merged_${label}_${stamp}.json`;

    const parts = [];
    parts.push(`# MERGED_PACK: ${label}`);
    parts.push(`# CREATED_AT: ${merged.createdAt}`);
    parts.push(`# PACKS: ${merged.packs.length}`);
    for (const p of merged.packs) {
      parts.push(`#   - ${p.source} • root=${p.rootName} • subfolder=${p.subfolder} • files=${p.fileCount}`);
    }
    parts.push("");
    parts.push("");

    for (const f of merged.files) {
      parts.push("===== FILE START =====");
      parts.push(`PATH: ${f.outPath}`);
      parts.push(`ORIGINAL_PATH: ${f.path}`);
      if (f.variantOf) parts.push(`VARIANT_OF: ${f.variantOf}`);
      parts.push(`BYTES: ${f.bytes}`);
      parts.push(`MTIME: ${f.mtime || ""}`);
      parts.push(`SHA256: ${f.sha256 || ""}`);
      parts.push("===== ORIGINS =====");
      for (const o of (f.origins || [])) {
        parts.push(`- ${o.source} • root=${o.rootName} • subfolder=${o.subfolder} • pack=${o.packId}`);
      }
      parts.push("===== CONTENT =====");
      parts.push(f.text || "");
      parts.push("===== FILE END =====");
      parts.push("");
    }

    dl(bundleName, parts.join("\n"), "text/plain");
    dl(manifestName, JSON.stringify(merged, null, 2), "application/json");
  }


  // =========================
  // STRUCTURE_DIFF_V7
  // =========================
  function buildTree(list){
    const root = {};
    for(const r of list){
      const parts = r.relPath.split("/");
      let n = root;
      for(const p of parts){
        n[p] = n[p] || {};
        n = n[p];
      }
    }
    return root;
  }

  function treeToAscii(node, prefix=""){
    const keys = Object.keys(node).sort();
    let out = "";
    keys.forEach((k, i)=>{
      const last = i === keys.length - 1;
      out += prefix + (last ? "└─ " : "├─ ") + k + "\n";
      out += treeToAscii(node[k], prefix + (last ? "   " : "│  "));
    });
    return out;
  }

  function overlayTrees(a,b){
    const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort();
    const out = {};
    for(const k of keys){
      if(a[k] && b[k]) out[k] = overlayTrees(a[k], b[k]);
      else out[k] = a[k] || b[k];
    }
    return out;
  }

  function renderStructures(){
    if(!state.A.loaded || !state.B.loaded) return;
    const tA = buildTree(state.A.list);
    const tB = buildTree(state.B.list);
    document.getElementById("treeA").textContent = treeToAscii(tA);
    document.getElementById("treeB").textContent = treeToAscii(tB);
    document.getElementById("treeOverlay").textContent = treeToAscii(overlayTrees(tA,tB));
  }

  document.querySelectorAll(".tab").forEach(t=>{
    t.onclick = ()=>{
      document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
      t.classList.add("active");
      const v = t.dataset.tab;
      document.querySelectorAll(".view > div").forEach(x=>x.classList.remove("active"));
      document.querySelector(`.view-${v}`).classList.add("active");
      if(v !== "files") renderStructures();
    };
  });


  // =========================
  // PERSIST_IGNORE_V7_1
  // =========================
  try{
    const saved = localStorage.getItem("folder_reader_custom_ignore") || "";
    const ta = document.getElementById("customIgnore");
    if(ta && !ta.value) ta.value = saved;
    ta?.addEventListener("input", () => {
      localStorage.setItem("folder_reader_custom_ignore", ta.value || "");
    });
  }catch(e){ /* ignore */ }


  // =========================
  // TABS_STRUCT_V7_1
  // =========================
  function buildTreeFromList(list){
    const root = {};
    for(const r of (list || [])){
      const parts = (r.relPath || "").split("/").filter(Boolean);
      let n = root;
      for(const p of parts){
        n[p] = n[p] || {};
        n = n[p];
      }
    }
    return root;
  }
  function treeToAscii(node, prefix=""){
    const keys = Object.keys(node).sort((a,b)=>a.localeCompare(b));
    let out = "";
    keys.forEach((k,i)=>{
      const last = i === keys.length - 1;
      out += prefix + (last ? "└─ " : "├─ ") + k + "\\n";
      out += treeToAscii(node[k], prefix + (last ? "   " : "│  "));
    });
    return out;
  }
  function overlayTrees(a,b){
    const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort((x,y)=>x.localeCompare(y));
    const out = {};
    for(const k of keys){
      if(a[k] && b[k]) out[k] = overlayTrees(a[k], b[k]);
      else out[k] = a[k] || b[k];
    }
    return out;
  }
  function renderStructuresNow(){
    if(!state.A?.loaded || !state.B?.loaded) return;
    const tA = buildTreeFromList(state.A.list);
    const tB = buildTreeFromList(state.B.list);
    const aEl = document.getElementById("treeA");
    const bEl = document.getElementById("treeB");
    const oEl = document.getElementById("treeOverlay");
    if(aEl) aEl.textContent = treeToAscii(tA);
    if(bEl) bEl.textContent = treeToAscii(tB);
    if(oEl) oEl.textContent = treeToAscii(overlayTrees(tA,tB));
  }
  function setActiveTab(name){
    document.querySelectorAll(".viewertabs .tab").forEach(btn=>{
      btn.classList.toggle("active", btn.dataset.tab === name);
    });
    const structWrap = document.getElementById("structWrap");
    const overlayWrap = document.getElementById("overlayWrap");
    if(structWrap) structWrap.classList.toggle("hidden", name !== "structure");
    if(overlayWrap) overlayWrap.classList.toggle("hidden", name !== "overlay");
    if(name !== "files") renderStructuresNow();
  }
  document.querySelectorAll(".viewertabs .tab").forEach(btn=>{
    btn.addEventListener("click", ()=> setActiveTab(btn.dataset.tab));
  });
  setActiveTab("files");


  // =========================
  // HELP_MODAL_V7_1
  // =========================
  const helpModal = document.getElementById("helpModal");
  const helpTitle = document.getElementById("helpTitle");
  const helpContent = document.getElementById("helpContent");
  const helpClose = document.getElementById("helpClose");

  const HELP = {
    folderA: `<b>Folder A</b><br><br>
      Load Folder A. Search filters by path. Clicking a file previews its text.<br><br>
      If “Link selections” is enabled, the tool tries to auto-select the matching file in B.`,
    folderB: `<b>Folder B</b><br><br>
      Load Folder B. Used for pairing/diff against A.`,
    report: `<b>Comparison Report</b><br><br>
      Summary of path pairing between A and B:<br>
      • Only in A<br>• Only in B<br>• Same path but different content<br>• Same (identical SHA-256)`,
    similarity: `<b>Manual Compare Similarity</b><br><br>
      Compare any file in A to any file in B (even different paths).<br><br>
      “Suggest match” proposes likely counterparts (useful after refactors). “Apply” pairs the selection for comparison (it does NOT rename files on disk).`,
    pack: `<b>Pack Merge</b><br><br>
      Create a “pack” from a subfolder (e.g., backend/routers). Add multiple packs (from loaded A/B or uploads).<br><br>
      Merge outputs:<br>
      • merged_*.txt (bundle format)<br>
      • merged_*.json (manifest with hashes + origins)<br><br>
      Dedup: same PATH + same SHA → one copy. Same PATH + different SHA → keep variants.`,
    ignore: `<b>Ignore Rules</b><br><br>
      Ignore patterns skip files/folders during load. Defaults include node_modules, dist, .venv, __pycache__, .git, etc.<br><br>
      Add your own in “Custom ignore”, one per line:<br>
      • *.png<br>• *.jpg<br>• logs/**<br><br>
      v7.1 saves your custom ignore locally in your browser (persists on reload).`
  };

  function openHelp(key){
    if(!helpModal) return;
    helpTitle.textContent = "Help";
    helpContent.innerHTML = HELP[key] || "No help available for this section.";
    helpModal.classList.remove("hidden");
  }
  document.querySelectorAll(".helpbtn").forEach(btn=>{
    btn.addEventListener("click", ()=> openHelp(btn.dataset.help));
  });
  helpClose?.addEventListener("click", ()=> helpModal.classList.add("hidden"));
  helpModal?.addEventListener("click", (e)=>{
    if(e.target === helpModal) helpModal.classList.add("hidden");
  });


  // =========================
  // COLLAPSE_V7_2
  // =========================
  (function(){
    const key = "folder_reader_panel_collapsed_v7_2";
    let saved = {};
    try{ saved = JSON.parse(localStorage.getItem(key) || "{}"); }catch(e){ saved = {}; }

    document.querySelectorAll("section.panel.collapsible").forEach(sec=>{
      const id = sec.dataset.panel || (sec.querySelector(".paneltitle")?.textContent || "").trim();
      if(saved[id]) sec.classList.add("collapsed");
      const btn = sec.querySelector(".collapsebtn");
      if(btn){
        btn.addEventListener("click", (e)=>{
          e.preventDefault();
          sec.classList.toggle("collapsed");
          const collapsed = sec.classList.contains("collapsed");
          try{
            saved[id] = collapsed;
            localStorage.setItem(key, JSON.stringify(saved));
          }catch(err){}
        });
      }
    });
  
// === FS Access API (offline-first) ===
async function loadFromFS(slot){
  if (!window.showDirectoryPicker) {
    throw new Error("File System Access API not available");
  }
  const dirHandle = await window.showDirectoryPicker();
  const files = [];
  async function walk(handle, prefix=""){
    for await (const entry of handle.values()){
      if (entry.kind === "file"){
        const file = await entry.getFile();
        files.push({
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          webkitRelativePath: prefix + file.name
        });
      } else if (entry.kind === "directory"){
        await walk(entry, prefix + entry.name + "/");
      }
    }
  }
  await walk(dirHandle, "");
  if (slot === "A") {
    loadFromWebkit("A", files);
  } else {
    loadFromWebkit("B", files);
  }
}

function attachFSButtons(){
  try {
    const labelA = document.querySelector('label.filebtn input#pickA')?.parentElement;
    const labelB = document.querySelector('label.filebtn input#pickB')?.parentElement;
    if (labelA) {
      labelA.addEventListener('click', async (e) => {
        if (window.showDirectoryPicker){
          e.preventDefault();
          await loadFromFS("A");
        }
      });
    }
    if (labelB) {
      labelB.addEventListener('click', async (e) => {
        if (window.showDirectoryPicker){
          e.preventDefault();
          await loadFromFS("B");
        }
      });
    }
  } catch (err) {
    console.warn("FS picker attach failed", err);
  }
}

document.addEventListener("DOMContentLoaded", attachFSButtons);

})();


  // =========================
  // BOTTOM_ROW_AUTO_V7_3
  // =========================
  (function(){
    const main = document.querySelector("main.grid");
    if(!main) return;

    function isCollapsed(panelKey){
      const sec = document.querySelector(`section.panel.${panelKey}`);
      return !!sec && sec.classList.contains("collapsed");
    }

    function update(){
      const bottomCollapsed = isCollapsed("ignore") && isCollapsed("pack");
      main.classList.toggle("bottom-collapsed", bottomCollapsed);
    }

    // Observe collapse toggles
    document.querySelectorAll("section.panel.collapsible").forEach(sec=>{
      const btn = sec.querySelector(".collapsebtn");
      if(btn){
        btn.addEventListener("click", ()=> setTimeout(update, 0));
      }
    });

    // Initial
    update();
  
// === FS Access API (offline-first) ===
async function loadFromFS(slot){
  if (!window.showDirectoryPicker) {
    throw new Error("File System Access API not available");
  }
  const dirHandle = await window.showDirectoryPicker();
  const files = [];
  async function walk(handle, prefix=""){
    for await (const entry of handle.values()){
      if (entry.kind === "file"){
        const file = await entry.getFile();
        files.push({
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          webkitRelativePath: prefix + file.name
        });
      } else if (entry.kind === "directory"){
        await walk(entry, prefix + entry.name + "/");
      }
    }
  }
  await walk(dirHandle, "");
  if (slot === "A") {
    loadFromWebkit("A", files);
  } else {
    loadFromWebkit("B", files);
  }
}

function attachFSButtons(){
  try {
    const labelA = document.querySelector('label.filebtn input#pickA')?.parentElement;
    const labelB = document.querySelector('label.filebtn input#pickB')?.parentElement;
    if (labelA) {
      labelA.addEventListener('click', async (e) => {
        if (window.showDirectoryPicker){
          e.preventDefault();
          await loadFromFS("A");
        }
      });
    }
    if (labelB) {
      labelB.addEventListener('click', async (e) => {
        if (window.showDirectoryPicker){
          e.preventDefault();
          await loadFromFS("B");
        }
      });
    }
  } catch (err) {
    console.warn("FS picker attach failed", err);
  }
}

document.addEventListener("DOMContentLoaded", attachFSButtons);

})();


  // =========================
  // THEME_PICKER_V7_4
  // =========================
  (function(){
    const sel = document.getElementById("themeSelect");
    const key = "folder_reader_theme_v7_4";
    const apply = (t)=>{
      document.body.setAttribute("data-theme", t || "default");
    };
    try{
      const saved = localStorage.getItem(key) || "default";
      apply(saved);
      if(sel) sel.value = saved;
    }catch(e){
      apply("default");
    }
    sel?.addEventListener("change", ()=>{
      const t = sel.value || "default";
      apply(t);
      try{ localStorage.setItem(key, t); }catch(e){}
    });
  
// === FS Access API (offline-first) ===
async function loadFromFS(slot){
  if (!window.showDirectoryPicker) {
    throw new Error("File System Access API not available");
  }
  const dirHandle = await window.showDirectoryPicker();
  const files = [];
  async function walk(handle, prefix=""){
    for await (const entry of handle.values()){
      if (entry.kind === "file"){
        const file = await entry.getFile();
        files.push({
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          webkitRelativePath: prefix + file.name
        });
      } else if (entry.kind === "directory"){
        await walk(entry, prefix + entry.name + "/");
      }
    }
  }
  await walk(dirHandle, "");
  if (slot === "A") {
    loadFromWebkit("A", files);
  } else {
    loadFromWebkit("B", files);
  }
}

function attachFSButtons(){
  try {
    const labelA = document.querySelector('label.filebtn input#pickA')?.parentElement;
    const labelB = document.querySelector('label.filebtn input#pickB')?.parentElement;
    if (labelA) {
      labelA.addEventListener('click', async (e) => {
        if (window.showDirectoryPicker){
          e.preventDefault();
          await loadFromFS("A");
        }
      });
    }
    if (labelB) {
      labelB.addEventListener('click', async (e) => {
        if (window.showDirectoryPicker){
          e.preventDefault();
          await loadFromFS("B");
        }
      });
    }
  } catch (err) {
    console.warn("FS picker attach failed", err);
  }
}

document.addEventListener("DOMContentLoaded", attachFSButtons);

})();


  // =========================
  // ROOT_LABELS_V7_4
  // =========================
  function setRootLabels(){
    const a = document.getElementById("rootAName");
    const b = document.getElementById("rootBName");
    if(a) a.textContent = state.A?.rootName ? state.A.rootName : "";
    if(b) b.textContent = state.B?.rootName ? state.B.rootName : "";
  }


// === FS Access API (offline-first) ===
async function loadFromFS(slot){
  if (!window.showDirectoryPicker) {
    throw new Error("File System Access API not available");
  }
  const dirHandle = await window.showDirectoryPicker();
  const files = [];
  async function walk(handle, prefix=""){
    for await (const entry of handle.values()){
      if (entry.kind === "file"){
        const file = await entry.getFile();
        files.push({
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          webkitRelativePath: prefix + file.name
        });
      } else if (entry.kind === "directory"){
        await walk(entry, prefix + entry.name + "/");
      }
    }
  }
  await walk(dirHandle, "");
  if (slot === "A") {
    loadFromWebkit("A", files);
  } else {
    loadFromWebkit("B", files);
  }
}

function attachFSButtons(){
  try {
    const labelA = document.querySelector('label.filebtn input#pickA')?.parentElement;
    const labelB = document.querySelector('label.filebtn input#pickB')?.parentElement;
    if (labelA) {
      labelA.addEventListener('click', async (e) => {
        if (window.showDirectoryPicker){
          e.preventDefault();
          await loadFromFS("A");
        }
      });
    }
    if (labelB) {
      labelB.addEventListener('click', async (e) => {
        if (window.showDirectoryPicker){
          e.preventDefault();
          await loadFromFS("B");
        }
      });
    }
  } catch (err) {
    console.warn("FS picker attach failed", err);
  }
}

document.addEventListener("DOMContentLoaded", attachFSButtons);

})();