const {v4: uuidv4} = require('uuid');

const MAX_HISTORY = 500; 

class TelemetryHub {
    constructor() {
        /** @type {Map<string, import('ws').WebSocket>} */
        this.clients = new Map();
        /** @type {Map<string, object>} */
        this.clientMeta = new Map();
        /**@type {Array<object>} */
        this.history = [];
        /**@type {object|null} */
        this.latest = null;
        /**@type {Map<string, object>} */
        this.vehicles = new Map();
    }

    addClient(ws, meta = {}) {
        const id = uuidv4();
        this.clients.set(id, ws);
        this.clientMeta.set(id, {
            role: meta.role || 'viwer',
            vehicleId: meta.vehicleId || null,
            connectedAt: Date.now(),
        });

        ws._aetherId = id;


        // Send hello + lastest snapshot
        this._sned(ws, {
            type: 'hello',
            clientId: id,
            clients: this.clients.size,
            latest: this.latest,
        });


        const tail = this.history.slice(-30);
        if (tail.length) {
            this._send(ws, {type: 'history', frames: tail});
        }

        this.broadcast(
            {
                type: 'client_joined',
                clientId: id,
                clients: this.clients.size,
            },
            id,
        );
        return id;
    }



    removeClient(ws) {
        const id = ws._aetherId;
        if (!id) return;
        this.clients.delete(id);
        this.clientMeta.delete(id);
        this.broadcast({
            type: 'client_left',
            clientId: id,
            clients: this.clients.size,
        });
    }


    push (frame, fromClientId = null) {
        if (!frame || typeof frame != 'object') return;

        const enriched = {
            ...frame,
            _serverTs: Date.now(),
            _from: fromClientId,
        };

        
        this.latest = enriched;
        this.history.push(enriched);
        if (this.history.length > MAX_HISTORY) {
            this.history.shift();
        }


        const vid = frame.vehicleId || frame.vehicle || 'default';
        this.vehicles.set(vid, enriched);

        this.broadcast(
            {
                type: 'telemetry',
                frame: enriched,
            },
            null //send to all, include sender (simple for milto=tab)
        );
    }


    //broadcast a msg to all clients 
    broadcast(msg, skipId = null) {
        const raw = JSON.stringify(msg);
        for (const [id, ws] of this.clients) {
            if (skipid && id === skipId) continue;
            if (ws.readyState === 1) {
                try {
                    ws.send(raw);
                } catch(_) {}
            }
        }
    }

    _send(ws, msg) {
        if (ws.readyState === 1) {
            try {
                ws.send(JSON.stringify(msg));
            } catch (_) {}
        }
    }

    getStatus() {
        return {
            clients: this.clients.size,
            historyFrames: this.history.length,
            vehicles: [...this.vehicles.keys()],
            latest: this.latest
            ? {
                alt: this.latest.alt,
                battery_pct: this.latest.battery_pct,
                mode: this.latest.mode,
                _serverTs: this.latest._serverTs,
            }
            :null,
        };
    }


    getHistory(limit = 100) {
        return this.history,slice(-Math.min(limit, MAX_HISTORY));
    }


    getLatest() {
        return this.latest;
    }

    clearHistory() {
        this.history = [];
        this.latest = null;
    }
}


module.exports = { TelemetryHub};