import React, { useEffect, useMemo, useState } from "react";

// Single-file React app: paint a grid, then export it as a .txt map
// Rows are exported as symbols defined with a configurable mapping.

export default function App() {
  const [size, setSize] = useState(16);
  const [currentColor, setCurrentColor] = useState("#1f2937"); // gray-800
  const [isPainting, setIsPainting] = useState(false);
  const [paintMode, setPaintMode] = useState("paint"); // "paint" | "erase" | "pick"
  const [showPreview, setShowPreview] = useState(false);
  const [exportStatus, setExportStatus] = useState("");

  // Initialize a size x size grid filled with white
  const makeGrid = (n) => Array.from({ length: n }, () => Array.from({ length: n }, () => "#ffffff"));
  const [grid, setGrid] = useState(() => makeGrid(size));

  // Rebuild grid when size changes
  useEffect(() => {
    setGrid(makeGrid(size));
  }, [size]);

  // Default palette
  const defaultPalette = [
    "#000000", "#ffffff", "#ef4444", "#22c55e", "#3b82f6",
    "#eab308", "#f97316", "#a855f7", "#ec4899", "#8b5cf6",
    "#10b981", "#6b7280", "#b91c1c", "#047857", "#1d4ed8"
  ];

  // ===== Symbol mapping (editable in UI) =====
  const [mappings, setMappings] = useState([
    { color: "#ffffff", symbol: " " }, // empty square = empty char
    { color: "#000000", symbol: "+" }, // black square = plus
    { color: "#ef4444", symbol: "0" }, // red square = 0
    { color: "#22c55e", symbol: "1" }, // green square = 1
  ]);

  const colorToSymbol = useMemo(() => {
    const obj = {};
    for (const { color, symbol } of mappings) {
      const key = toHex6(color);
      obj[key] = symbol ?? " ";
    }
    return obj;
  }, [mappings]);

  // ===== Painting helpers =====
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

  const handleCellAction = (r, c, type) => {
    setGrid((prev) => {
      const next = prev.map((row) => row.slice());
      if (type === "paint") {
        next[r][c] = currentColor;
      } else if (type === "erase") {
        next[r][c] = "#ffffff";
      } else if (type === "pick") {
        setCurrentColor(next[r][c]);
      }
      return next;
    });
  };

  const onPointerDown = (r, c) => {
    setIsPainting(true);
    handleCellAction(r, c, paintMode);
  };

  const onPointerEnter = (r, c) => {
    if (isPainting) handleCellAction(r, c, paintMode);
  };

  useEffect(() => {
    const up = () => setIsPainting(false);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointerleave", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointerleave", up);
    };
  }, []);

  // ===== Grid actions =====
  const clearGrid = () => setGrid(makeGrid(size));
  const fillGrid = () => setGrid(Array.from({ length: size }, () => Array.from({ length: size }, () => currentColor)));

  // ===== Export helpers =====
  const buildContent = () => {
    const header = `# Grid Size: ${size}x${size}\n# Format: rows of symbols based on color mapping\n`;
    const body = grid
      .map((row) => row.map((c) => {
        const key = toHex6(c);
        // Use mapping if present; otherwise fallback to '.' so unmapped colors are visible
        return Object.prototype.hasOwnProperty.call(colorToSymbol, key)
          ? colorToSymbol[key]
          : " ";
      }).join(""))
      .join("\n");
    return body;
  };

  const filenameForNow = () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `map_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.txt`;
  };

  const exportTxt = async () => {
    const content = buildContent();
    const filename = filenameForNow();

    // Try modern File System Access API first (more reliable in some sandboxes)
    try {
      if ("showSaveFilePicker" in window) {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: "Text", accept: { "text/plain": [".txt"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        setExportStatus("Saved to file.");
        return;
      }
    } catch (e) {
      // Fall back to blob download below
    }

    // Fallback: blob + temporary anchor
    try {
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoke URL to avoid leaks
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setExportStatus("Download started.");
      return;
    } catch (e) {
      // Last resort: open in a new tab (may still be blocked by sandbox)
      try {
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        setExportStatus("Opened map in a new tab.");
        return;
      } catch (_) {
        setExportStatus("Export failed. Try Copy Text.");
      }
    }
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(buildContent());
      setExportStatus("Copied to clipboard.");
    } catch (e) {
      setExportStatus("Clipboard copy not permitted.");
    }
  };

  function toHex6(c) {
    if (!c) return "#000000";
    if (typeof c === "string" && c.startsWith("#")) {
      if (c.length === 4) {
        const r = c[1], g = c[2], b = c[3];
        return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
      }
      if (c.length === 7) return c.toLowerCase();
    }
    const m = String(c).match(/rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)/i);
    if (m) {
      const [r, g, b] = m.slice(1).map((n) => clamp(parseInt(n, 10), 0, 255));
      const h = (n) => n.toString(16).padStart(2, "0");
      return `#${h(r)}${h(g)}${h(b)}`;
    }
    return "#000000";
  }

  // Fallback cell sizing so it works even without Tailwind
  const cellPx = useMemo(() => 24, []);
  const gridStyle = useMemo(
    () => ({
      display: "grid",
      gridTemplateColumns: `repeat(${size}, ${cellPx}px)`,
      gap: 2,
      background: "#e5e7eb",
      padding: 2,
      borderRadius: 12,
      overflow: "auto",
      touchAction: "none",
    }),
    [size, cellPx]
  );

  // ===== Mapping editor UI =====
  const updateMapping = (i, patch) => {
    setMappings((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  };
  const addMapping = () => setMappings((prev) => [...prev, { color: currentColor, symbol: "X" }]);
  const removeMapping = (i) => setMappings((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Grid Map Painter</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={exportTxt}
              className="px-4 py-2 rounded-2xl shadow hover:shadow-md bg-slate-900 text-white text-sm font-medium"
            >
              Export .txt
            </button>
            <button
              onClick={copyText}
              className="px-4 py-2 rounded-2xl shadow hover:shadow-md bg-white border text-sm font-medium"
            >
              Copy text
            </button>
            <button
              onClick={() => setShowPreview((s) => !s)}
              className="px-4 py-2 rounded-2xl shadow hover:shadow-md bg-white border text-sm font-medium"
            >
              {showPreview ? "Hide preview" : "Preview"}
            </button>
          </div>
        </header>

        {exportStatus && (
          <div className="bg-emerald-50 text-emerald-900 border border-emerald-200 px-4 py-2 rounded-xl text-sm">
            {exportStatus}
          </div>
        )}

        <section className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Controls */}
          <aside className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl shadow p-4 space-y-4">
              <h2 className="font-medium">Grid</h2>
              <div className="flex items-center gap-2">
                <label className="text-sm">Size:</label>
                <select
                  value={size}
                  onChange={(e) => setSize(parseInt(e.target.value, 10))}
                  className="px-3 py-2 rounded-xl border text-sm"
                >
                  {[4, 6, 7, 8, 9, 10, 11,   12, 16, 24, 32, 48].map((n) => (
                    <option key={n} value={n}>{n} × {n}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={clearGrid} className="px-3 py-2 rounded-xl border text-sm hover:bg-slate-50">Clear</button>
                <button onClick={fillGrid} className="px-3 py-2 rounded-xl border text-sm hover:bg-slate-50">Fill with Current</button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow p-4 space-y-4">
              <h2 className="font-medium">Brush</h2>
              <div className="flex items-center gap-2">
                {["paint", "erase", "pick"].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setPaintMode(mode)}
                    className={`px-3 py-1.5 rounded-xl border text-xs capitalize ${paintMode === mode ? "bg-slate-900 text-white" : "bg-white"}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm">Current:</div>
                <div className="w-6 h-6 rounded-lg border" style={{ background: currentColor }} />
                <input
                  type="color"
                  value={currentColor}
                  onChange={(e) => setCurrentColor(e.target.value)}
                  className="w-10 h-10 p-0 border rounded-xl overflow-hidden"
                  title="Pick any color"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {defaultPalette.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCurrentColor(c)}
                    className="w-7 h-7 rounded-md border"
                    style={{ background: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow p-4 space-y-3">
              <h2 className="font-medium">Symbol mappings</h2>
              <p className="text-sm text-slate-600">Please do not edit mappings</p>
              <div className="space-y-2">
                {mappings.map((m, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="color"
                      value={m.color}
                      onChange={(e) => updateMapping(i, { color: e.target.value })}
                      className="w-10 h-10 p-0 border rounded-lg"
                      title="Mapped color"
                    />
                    <input
                      type="text"
                      value={m.symbol}
                      onChange={(e) => updateMapping(i, { symbol: e.target.value.slice(0, 1) })}
                      className="px-2 py-2 rounded-lg border w-16 text-center"
                      placeholder="(blank)"
                      title="Symbol (1 char)"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow p-4 text-sm text-slate-600">
              <p>Tip: Click and drag to paint. Switch to <span className="font-medium">Pick</span> to eyedrop a color from the grid. Use <span className="font-medium">Erase</span> to set cells back to white.</p>
              <p className="mt-2">Exported <code>.txt</code> uses your mapping. Unmapped colors show up as <code>.</code>.</p>
            </div>
          </aside>

          {/* Canvas */}
          <main className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-2xl shadow p-4">
              <div
                className="grid gap-0.5 bg-slate-200 p-0.5 rounded-xl"
                style={gridStyle}
              >
                {grid.map((row, r) =>
                  row.map((color, c) => (
                    <div
                      key={`${r}-${c}`}
                      onPointerDown={() => onPointerDown(r, c)}
                      onPointerEnter={() => onPointerEnter(r, c)}
                      role="button"
                      aria-label={`cell ${r + 1},${c + 1}`}
                      className="cursor-crosshair rounded-[4px] border border-white"
                      style={{ background: color, width: cellPx, height: cellPx }}
                    />
                  ))
                )}
              </div>
            </div>

            {showPreview && (
              <div className="bg-white rounded-2xl shadow p-4">
                <h3 className="font-medium mb-2">Preview</h3>
                <textarea
                  readOnly
                  value={buildContent()}
                  className="w-full h-64 border rounded-xl p-3 font-mono text-xs"
                />
              </div>
            )}
          </main>
        </section>
      </div>
    </div>
  );
}
