(function (global) {
  "use strict";

  const FIELDS = [
    "time",        
    "vehicle",     
    "armed",       
    "mode",        
    "roll",        
    "pitch",      
    "heading",     
    "alt",     
    "vspeed",      
    "airspeed",    
    "groundspeed",
    "lat",         
    "lon",      
    "distHome", 
    "voltage",    
    "current",   
    "batteryPct",  
    "rssi",        
    "sats",       
    "hdop"         
  ];

  const state = {
    time: 0, vehicle: "quad", armed: false, mode: "STABILIZE",
    roll: 0, pitch: 0, heading: 0,
    alt: 0, vspeed: 0, airspeed: 0, groundspeed: 0,
    lat: 0, lon: 0, distHome: 0,
    voltage: 0, current: 0, batteryPct: 100,
    rssi: 0, sats: 0, hdop: 99
  };

  const subscribers = new Set();
  let lastUpdate = 0; 


  function update(data, source = "live") {
    Object.assign(state, data);
    if (data.time === undefined) state.time = Date.now();
    lastUpdate = performance.now();

    const snapshot = { ...state };
    subscribers.forEach(fn => {
      try { fn(snapshot, source); }
      catch (err) { console.error("[Telemetry] subscriber crashed:", err); }
    });
  }

  function subscribe(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }

  
  function get() { return { ...state }; }

 
  function msSinceUpdate() {
    return lastUpdate ? performance.now() - lastUpdate : Infinity;
  }

  global.Telemetry = { FIELDS, update, subscribe, get, msSinceUpdate };
})(window);
