
(function (global) {
  "use strict";

  const HOME = { lat: 23.2599, lon: 77.4126 }; 
  const CRUISE_ALT = 50;      
  const CIRCLE_RADIUS = 80;   
  const CRUISE_SPEED = 8;     
  const FULL_V = 16.8, EMPTY_V = 13.2;

  let timer = null;
  let sim, drainMultiplier = 1, linkLossUntil = 0;

  function reset() {
    sim = { t: 0, alt: 0, angle: 0, battery: 100, armed: false, mode: "STABILIZE" };
  }

  function step(dt) {
    sim.t += dt;

    
    if (sim.t > 2 && !sim.armed) { sim.armed = true; sim.mode = "GUIDED"; }

    let vspeed = 0;
    if (sim.armed && sim.alt < CRUISE_ALT) {
      vspeed = 3;
      sim.alt = Math.min(CRUISE_ALT, sim.alt + vspeed * dt);
      if (sim.alt >= CRUISE_ALT) sim.mode = "AUTO";
    }
    let groundspeed = 0;
    if (sim.alt >= CRUISE_ALT) {
      groundspeed = CRUISE_SPEED;
      sim.angle += (CRUISE_SPEED / CIRCLE_RADIUS) * dt;
    }
    const east = sim.alt >= CRUISE_ALT ? CIRCLE_RADIUS * Math.sin(sim.angle) : 0;
    const north = sim.alt >= CRUISE_ALT ? CIRCLE_RADIUS * (1 - Math.cos(sim.angle)) : 0;
    const lat = HOME.lat + north / 111320;
    const lon = HOME.lon + east / (111320 * Math.cos(HOME.lat * Math.PI / 180));

    const heading = ((sim.angle * 180 / Math.PI) + 360) % 360;
    const roll = groundspeed
      ? Math.atan((groundspeed ** 2) / (CIRCLE_RADIUS * 9.81)) * 180 / Math.PI
      : 0;


    const current = sim.armed ? (groundspeed ? 18 : 12) : 0.5;
    sim.battery = Math.max(0, sim.battery - current * 0.03 * dt * drainMultiplier);
    const voltage = EMPTY_V + (FULL_V - EMPTY_V) * (sim.battery / 100);

    const noise = (n) => (Math.random() - 0.5) * n;

    return {
      vehicle: "quad",
      armed: sim.armed,
      mode: sim.mode,
      roll: +(roll + noise(1)).toFixed(2),
      pitch: +(noise(1.5) + (groundspeed ? -3 : 0)).toFixed(2),
      heading: +heading.toFixed(1),
      alt: +sim.alt.toFixed(2),
      vspeed: +vspeed.toFixed(2),
      airspeed: groundspeed ? +(groundspeed + noise(0.6)).toFixed(2) : 0,
      groundspeed: +groundspeed.toFixed(2),
      lat: +lat.toFixed(7),
      lon: +lon.toFixed(7),
      distHome: +Math.hypot(east, north).toFixed(1),
      voltage: +voltage.toFixed(2),
      current: +(current + noise(1)).toFixed(2),
      batteryPct: +sim.battery.toFixed(1),
      rssi: Math.round(85 + noise(10) - Math.hypot(east, north) / 20),
      sats: 12 + Math.round(noise(2)),
      hdop: +(0.8 + Math.random() * 0.4).toFixed(2)
    };
  }

  function start(hz = 10) {
    if (timer) return;
    if (!sim) reset();
    const dt = 1 / hz;
    timer = setInterval(() => {
      const data = step(dt);
      if (performance.now() < linkLossUntil) return;
      Telemetry.update(data, "live");
    }, 1000 / hz);
  }

  function stop() { clearInterval(timer); timer = null; }

  function isRunning() { return timer !== null; }

  function setDrainRate(multiplier) { drainMultiplier = multiplier; }

  reset();
  global.FakeSource = { start, stop, reset, isRunning, simulateLinkLoss, setDrainRate };
})(window);
