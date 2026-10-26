(function (global) {
  "use strict";

  const FORMAT = "aetherlink-flight";
  const VERSION = 1;

  function toJSON(frames, meta = {}) {
    return JSON.stringify({
      format: FORMAT,
      version: VERSION,
      exportedAt: new Date().toISOString(),
      meta,
      fields: Telemetry.FIELDS,
      frames
    });
  }

  function toCSV(frames) {
    const header = ["t_ms", ...Telemetry.FIELDS];
    const rows = frames.map(f =>
      [Math.round(f.t), ...Telemetry.FIELDS.map(k => f.d[k])].map(csvCell).join(",")
    );
    return [header.join(","), ...rows].join("\r\n");
  }

  function csvCell(value) {
    if (value === undefined || value === null) return "";
    const s = String(value);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function download(filename, text, mime = "text/plain") {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

    function stampedName(prefix = "flight") {
    const d = new Date();
    const p = n => String(n).padStart(2, "0");
    return `${prefix}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
           `_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
  }

  function downloadJSON(frames, meta) {
    download(stampedName() + ".json", toJSON(frames, meta), "application/json");
  }

  function downloadCSV(frames) {
    download(stampedName() + ".csv", toCSV(frames), "text/csv");
  }

 
  function importJSON(file) {
    return file.text().then(text => {
      const data = JSON.parse(text);
      if (data.format !== FORMAT || !Array.isArray(data.frames)) {
        throw new Error("Not an AetherLink flight file");
      }
      return data.frames;
    });
  }

  global.Exporter = { toJSON, toCSV, download, downloadJSON, downloadCSV, importJSON };
})(window);
