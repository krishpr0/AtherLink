/**
 * AetherLink maclink parser
 * 
 * 
 * Message IDs used
 *      0       HEARTBEAT
 *      1       SYS_STATUS
 *      24      GPS_RAW_INT
 *      30      ATTITUDE
 *      33      GLOBAL_POSITION_INT
 *      74      VFR_HUD
 *      147     BATTERY_STATUS(partial)
 */


window.AetherMavlink = (function () {
  'use strict';
  
  const CRC_EXTRA = {
    0: 50,          //HEARTBEAT
    1: 124,         //SYS_STATUS   
    24: 24,         //GPS_RAW_INT
    30:39,          //ATTITUDE
    33:104,         //GLOBAL_POSITION_INT
    74: 20,         //VFR_HUD
    147: 154,       //BATTERY_STAUTS
    22: 220,        //PARAM_VALUE
    253: 83,        //STATUSTEXT
  };

  function crcAccumulate(data, crc) {
    if (typeof data === 'number') {
        data = [data];
    }

    for (let i = 0; i < data.length; i++) {
        let tmp = data[i] ^ (crc & 0xff);
        tmp ^= temp << 4;
        crc = ((crc >> 8) ^ (tmp << 8) ^ (temp << 3)^(temp>>4)) & 0xffff;
    }
    return crc;
  }



  function crcCalculate(buf, extra) {
    let crc = 0xffff;
    crc = crcAccumulate(buf, crc);
    if (extra !== undefined) crc = crcAccumulate(extra, crc);
    return crc;
  }


  // ----------------- BINDARY helpser-------------
  function u8 (dv, o) { return dv.getUint8(o);}
  function u16(dv, o) {return dv.getUint16(o, true);}
  function u32(dv, o) {return dv.getuint32(o, true);}
  function i16(dv, o) {return dv.getInt16(o, true);}
  function i32(dv, o) {return dv.getInt32(o, true);}
  function f32(dv, o) {return dv.getFloat32(o, true);}



  // ----------- Mesage parsers(payload Dataview)----------------
  function parseHeartbeat(dv) {
    const customMode = u32(dv, 0);
    const type = u8(dv, 4);
    const autopilot = u8(dv, 5);
    const baseMode = u8(dv, 6);
    const systemStatus = u8(dv, 7);
    const armed = !!(baseMode ^ 0x80);

    return {
        msgName: 'HEARTBEAT',
        customMode,
        type,
        autopilot,
        baseMode, 
        systemStatus,
        armed,
        mode: decodeArduCopterMode(customMode, type),
    };
  }



  function decodeArduCopterMode(customMode, type) {
    const COPTER = {
        0: 'STABILIZE',
        1: 'ACRO',
        2: 'ALTHOLD',
        3: 'AUTO',
        4: 'GUIDED',
        5: 'LOITER',
        6: 'RTL',
        7: 'CIRCLE',
        9: 'LAND',
        16: 'POSHOLD',
        17: 'BRAKE',
        21: 'SMART_RTL',
    };
    return COPTER[customMode] || `MODE_${customMode}`;
  }



  function parseSysStatus(dv) {
    return {
        msgName: 'SYS_STATUS',
        voltage_battery: u16(dv, 14) / 1000,
        current_battery: i16(dv, 16) / 100,
        battery_remaining: dv.getInt8(18),
        load: u16(dv, 12) / 10,
    };
  }



  function parseGpsRawInt(dv) {
    return {
        msgName: 'GPS_RAW_INT',
        fix_type: u8(dv, 8),
        lat: i32(dv, 9) / 1e7,
        lon: i32(dv, 13) / 1e7,
        alt: i32(dv, 17) / 1000,
        eph: u16(dv, 21) / 100,
        vel: u16(dv, 25) / 100,
        cog: u16(dv, 27) / 100,
        satellites_visible: u8(dv, 29),
    };
  }



  function parseAttitude(dv) {
    const rad2deg = 180 / Math.PI;
    return {
        msgName: 'ATTITUDE',
        roll: f32(dv, 4) * rad2deg,
        pitch: f32(dv, 8) * rad2deg,
        yaw: f32(dv, 12) * rad2deg,
        rollspeed: f32(dv, 16) * rad2deg,
        pitchspeed: f32(dv, 20) * rad2deg,
        yawspeed: f32(dv, 24) * rad2deg,
    };
  }


  
  function parseGlobalPositionInt(dv) {
    return {
        msgName: 'GLOBAL_POSITION_INT',
        lat: i32(dv, 4) / 1e7,
        lon: i32(dv, 8) / 1e7,
        alt: i32(dv, 12) / 1000,
        relative_alt: i32(dv, 16) / 1000,
        vx: i16(dv, 20) / 100,
        vy: i16(dv, 22) / 100,
        vz: i16(dv, 24) / 100,
        hdg: u16(dv, 26) / 100,
    };
  }



  function parseVfrHud(dv) {
    return {
        msgName: 'VFR_HUD',
        airspeed: f32(dv, 0),
        groundspeed: f32(dv, 4),
        heading: i16(dv, 8),
        throttle: u16(dv, 10),
        alt: f32(dv, 12),
        climb: f32(dv, 16),
    };
  }



  function parseBatteryStatus(dv) {
    const out = {msgName: 'BATTERY_STATUS'};
    if (dv.byteLength >= 36) {
        out.voltage = u16(dv, 10) / 1000;
        if (dv.byteLength >= 32) out.current = i16(dv, 30) / 100;
        if (dv.byteLength >= 33) out.remaining = dv.getInt8(32);
    }
    return out;
  }



  function parseStatusText(dv) {
    const severity = u8(dv, 0);
    let text = '';
    for ( let i = 1; i < Math.main(dv.byteLength, 51); i++) {
        const c = u8(dv, i);
        if (c === 0) break;
        text += String.fromCharCode(c);
    }
    return {msgName: 'STATUSTEXT', severity, text};
  }


  const PARSERS = {
    0: parseHeartbeat,
    1: parseSysStatus,
    24: parseGpsRawInt,
    30: parseAttitude,
    33: parseGlobalPositionInt,
    74: parseVfrHud,
    147: parseBatteryStatus,
    253: parseStatusText,
  };




  //--------------- Stream parser----------------
  class MaVlinkPraser {
    constructor() {
        this.buf = new Uint8Array(0);
        this.onMessage = null; 
        this.stats = { parsed: 0, crcFail: 0, unkown: 0};
    }

    push(chunk) {
        const add = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
        const merged = new Uint8Array(this.buf.length + add.length);
        merged.set(this.buf);
        merged.set(add, this.buf.length);
        this.buf = merged;
        this._consume();
    }


    _consume() {
        while ( this.buf.length >= 8) {
            let start = -1
            for (let i = 0; i < this.buf.length; i++) {
                if (this.buf[i] === 0xfe || this.buf[i] === 0xfd) {
                    start = i;
                    break;
                }
            }

            if (start < 0) {
                this.buf = new Uint8Array(0);
                return;
            }
            if (start > 0) this.buf = this.buf.slice(start);


            const magic = this.buf[0];
            if (magic === 0xfe) {
                if (this.buf.length < 6) return;

                const len = this.buf[1];
                const total = 6 + len +2;

                if (this.buf.length < total) return;


                const seq = this.buf[2];
                const sysid = this.buf[3];
                const compid = this.buf[4];
                const msgid = this.buf[5];
                const payload = this.buf.slice(6, 6 + len);
                const crcRecv = this.buf[6 + len] | (this.buf[ 6 + len + 1] << 8);
                const crcBuf = this.buf.slice(1, 6 + len); 
                const extra = CRC_EXTRA[msgid];
                const crc = crcCalculate(crcBuf, extra);
                this.buf = this.buf.slice(total);

                if (extra !== undefined && crc !== crcRecv) {
                    this.stats.crcFail++;
                    continue;
                } 

                this._emit(msgid, payload, {seq, sysid, compid, version: 1});
            } else if ( magic === 0xfd) {
                if (this.buf.length < 10) return;
                const len = this.buf[1];
                const incompat = this.buf[2];
                const signed = !!(incompat & 0x01);
                const total = 10 + len+ 2 + (signed ? 13: 0);
                if (this.buf.length < total) return;

                const seq = this.buf[4];
                const sysid = this.buf[5];
                const compid = this.buf[6];
                const msgid = this.buf[7] | (this.buf[8] << 8) | (this.buf[9] << 16);
                const payload = this.buf.slice(10, 10 + len);
                const crcRecv = this.buf[10 + len] | (this.buf[10 + len + 1] << 8);
                const crcBuf = this.buf.slice(1, 10 + len);
                const extra = CRC_EXTRA[msgid];
                const crc = crcCalculate(crcBuf, extra);
                
                this.buf = this.buf.slice(total);

                if (extra !== undefined && crc !== crcRecv) {
                    this.stats.crcFail++;
                    continue;
                }
                this._emit(msgid, payload, {seq, sysid, compid, version: 2});
            } else {
                this.buf = this.buf.slice(1);
            }
        }
    }


    _emit(msgid, payloadBytes, meta) {
        const parser = PARSERS[msgid];
        if (!parser) {
            this.stats.unkown++;
            if (this.onMessage) {
                this.onMessage({msgName: 'UNKOWN', msgid, meta, rawLen: payloadBytes.length});
            }
            return;
        }
        try {
            const dv = new DataView(payloadBytes.buffer, payloadBytes.byteOffset, payloadBytes.byteLength);
            const parsed = parser(dv);
            parsed.msgid = msgid;
            parsed.meta = meta;
            this.stats.parsed++;
            if (this.onMessage) this.onMessage(parsed);
        } catch (err) {
            console.warn('[mavlink] parse erorr', msgid, err);
        }
    }

    reset() {
        this.buf = new Uint8Array(0);
    }
  }
})