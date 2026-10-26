(function (global) {
  "use strict";


  const RULES = [
    { id: "batt-crit", level: "critical", msg: "Battery critical",  voice: "Battery critical. Land now.",
      test: s => s.armed && s.batteryPct < 10 },
    { id: "batt-low",  level: "warning",  msg: "Battery low",       voice: "Low battery",
      test: s => s.armed && s.batteryPct < 20 && s.batteryPct >= 10 },
    { id: "gps-sats",  level: "warning",  msg: "Weak GPS (few satellites)", voice: "GPS weak",
      test: s => s.armed && s.sats < 6 },
    { id: "gps-hdop",  level: "warning",  msg: "Poor GPS accuracy", voice: null,
      test: s => s.armed && s.hdop > 2.5 },
    { id: "rssi-low",  level: "warning",  msg: "Weak radio signal", voice: "Signal weak",
      test: s => s.armed && s.rssi < 30 },
    { id: "alt-limit", level: "warning",  msg: "Above 120 m limit", voice: "Altitude limit",
      test: s => s.alt > 120 }
  ];

  const LINK_LOST_MS = 3000;
  const LINK_RULE = { id: "link-lost", level: "critical", msg: "Telemetry link lost", voice: "Link lost" };

  const active = new Map(); // id -> rule
  const changeListeners = new Set();
  let container = null;
  let muted = false;
  let audioCtx = null;
  let everReceived = false;


  Telemetry.subscribe(snapshot => {
    everReceived = true;
    setActive(LINK_RULE, false);
    RULES.forEach(rule => setActive(rule, !!rule.test(snapshot)));
  });

  
  setInterval(() => {
    if (everReceived) setActive(LINK_RULE, Telemetry.msSinceUpdate() > LINK_LOST_MS);
  }, 500);

  function setActive(rule, isActive) {
    const was = active.has(rule.id);
    if (isActive && !was) {
      active.set(rule.id, rule);
      announce(rule);
      render();
    } else if (!isActive && was) {
      active.delete(rule.id);
      render();
    }
  }


  function unlockAudio() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
    } catch (e) { /* no audio available */ }
  }

  function beep(times, freq) {
    if (!audioCtx) return;
    for (let i = 0; i < times; i++) {
      const start = audioCtx.currentTime + i * 0.25;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    }
  }

  function speak(text) {
    if (!text || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    speechSynthesis.speak(u);
  }

  function announce(rule) {
    changeListeners.forEach(fn => fn(list()));
    if (muted) return;
    if (rule.level === "critical") beep(3, 880); else beep(1, 660);
    setTimeout(() => speak(rule.voice), rule.level === "critical" ? 800 : 300);
  }


  function mount(el) {
    container = el;
    render();
  }

  function render() {
    changeListeners.forEach(fn => fn(list()));
    if (!container) return;
    const items = list().sort((a, b) => (a.level === "critical" ? -1 : 1));
    container.innerHTML = items.map(r =>
      `<div class="al-alert al-${r.level}">${r.level === "critical" ? "⛔" : "⚠️"} ${r.msg}</div>`
    ).join("");
  }

  function list() { return [...active.values()]; }

  function setMuted(m) {
    muted = m;
    if (m && "speechSynthesis" in window) speechSynthesis.cancel();
  }

  function onChange(fn) {
    changeListeners.add(fn);
    return () => changeListeners.delete(fn);
  }

  global.Alerts = { RULES, mount, unlockAudio, setMuted, list, onChange };
})(window);
