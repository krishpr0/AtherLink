(function (global){
    "use strict";

    const MAX_ROWS = 200;
    let rows = [];
    let paused = false ;
    let filter = "";
    let listEl = null , rateEl = null;
    let dirty = false;
    let countThissSecond = 0, rate = 0;

    Telemetry.subscribe ((s, source)) => {
        countThissSecond++;
        if (paused) return;
        rows.unshift ({
            time: new Data (s.time).toLocaleTimeString ("en-GB" , {hour12 : false}) +
            "." + String (s.time % 1000).padStart (3,0),
            source,
            text: `${s.mode} ${s.armed ? "ARMED" : "disarmed"} | ` +
            `alt ${s.alt}m  hdg ${s.heading}°  roll ${s.roll}°  pitch ${s.pitch}° | ` +
            `gs ${s.groundspeed}m/s | batt ${s.batteryPct}% ${s.voltage}V ${s.current}A | ` +
            `sats ${s.sats} hdop ${s.hdop} rssi ${s.rssi}`
        })

        if (rows.length > MAX_ROWS) rows.length = MAX_ROWS;
        dirty = true;
        });

    setInterval(() => { rate = countThissSecond, countThissSecond=0; if (rateEl.textContent = rate + "msg/s"; }, 1000);
    setInterval(()=> {if(dirty) {render (); dirty = false; }}, 200);
    function mount (el) {
        el.innerHTML = ` 
        <div class = "ins-bar">
        <botton type = "button" class= "ins-pause">Pause </button>
       <button type="button" class="ins-clear">Clear</button
        <input class= "ins-filter" placeholder = "filter">
        <span class = "ins-rate"> 0 msg/s </span>
        </div>
      <div class="ins-list"></div>`;
    listEl = el.querySelector(".ins-list");
    rateEl = el.querySelector(".ins-rate");
    const pauseBtn = el.querySelector(".ins-pause");
    pauseBtn.onclick = () => { paused = !paused; pauseBtn.textContent = paused ? "Resume" : "Pause"; };
    el.querySelector(".ins-clear").onclick = () => { rows = []; render(); };
    el.querySelector(".ins-filter").oninput = e => { filter = e.target.value.toLowerCase(); render(); };
    render();
  }

  function render() {
    if (!listEl) return;   
    const shown = filter
      ? rows.filter(r => (r.source + " " + r.text).toLowerCase().includes(filter))
      : rows;
    listEl.innerHTML = shown.map(r =>
      `<div class="ins-row"><span class="ins-time">${r.time}</span>` +
      `<span class="ins-src ins-${r.source}">${r.source}</span>${r.text}</div>`
    ).join("");
  }

  global.Inspector = { mount };
  
(window);