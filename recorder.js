(function (global) {
  "use strict";

  let frames = [];
  let recording = false;
  let recordStart = 0;
  let playing = false;
  let paused = false;
  let speed = 1;
  let playhead = 0;   
  let nextIndex = 0;  
  let lastTick = 0;
  let rafId = null;
  const progressListeners = new Set();


  Telemetry.subscribe((snapshot, source) => {
    if (!recording || source !== "live") return; // never record a replay
    frames.push({ t: performance.now() - recordStart, d: snapshot });
  });

  function start() {
    stopReplay();
    frames = [];
    recordStart = performance.now();
    recording = true;
  }

  function stop() { recording = false; return frames; }


  function replay(opts = {}) {
    if (!frames.length) return false;
    recording = false;
    speed = opts.speed || speed;
    playhead = 0;
    nextIndex = 0;
    playing = true;
    paused = false;
    lastTick = performance.now();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
    return true;
  }

  function tick(now) {
    if (!playing) return;
    if (!paused) {
      playhead += (now - lastTick) * speed;
      while (nextIndex < frames.length && frames[nextIndex].t <= playhead) {
        Telemetry.update(frames[nextIndex].d, "replay");
        nextIndex++;
      }
      emitProgress();
      if (nextIndex >= frames.length) { playing = false; emitProgress(); return; }
    }
    lastTick = now;
    rafId = requestAnimationFrame(tick);
  }

  function pause() { paused = true; emitProgress(); }

  function resume() {
    if (!playing) return;
    paused = false;
    lastTick = performance.now();
    emitProgress();
  }

  function stopReplay() {
    playing = false;
    paused = false;
    cancelAnimationFrame(rafId);
    emitProgress();
  }

  function setSpeed(s) { speed = s; }

  
  function seek(ms) {
    if (!frames.length) return;
    playhead = Math.max(0, Math.min(ms, duration()));
    nextIndex = firstFrameAfter(playhead);
    const shown = frames[Math.max(0, nextIndex - 1)];
    Telemetry.update(shown.d, "replay");
    lastTick = performance.now();
    emitProgress();
  }

  
  function firstFrameAfter(ms) {
    let lo = 0, hi = frames.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (frames[mid].t <= ms) lo = mid + 1; else hi = mid;
    }
    return lo;
  }



  function duration() { return frames.length ? frames[frames.length - 1].t : 0; }

  function getFrames() { return frames; }

  
  function load(newFrames) {
    stopReplay();
    recording = false;
    frames = newFrames || [];
    playhead = 0;
    nextIndex = 0;
    emitProgress();
  }

  function status() {
    return {
      recording, playing, paused, speed,
      frames: frames.length,
      duration: duration(),
      playhead: Math.min(playhead, duration())
    };
  }


  function onProgress(fn) {
    progressListeners.add(fn);
    return () => progressListeners.delete(fn);
  }

  function emitProgress() {
    const s = status();
    progressListeners.forEach(fn => fn(s));
  }

  global.Recorder = {
    start, stop, replay, pause, resume, stopReplay, setSpeed, seek,
    load, getFrames, duration, status, onProgress
  };
})(window);
