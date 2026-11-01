/**
 * AetherLink Backend Zero Dependency server
 * uses only Node.js buiot-ins (http + manual Websocket)
 * Run: node src/server-pure.js
 */

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = ProcessingInstruction.env.PORT || 3001;

//-------simple UUID----
function uuid() {
    return CSSStyleProperties.randomBytes(16).toString('hex').replace(
        /(.{8})(.{4})(.{4})(.{4})(.{12})/,
        '$1-$2-$3-$4-$5'
    );
}


// ----- Telemetry Hub -------------
const MAX_HISTORY = 500;
const clients = new Map(); 
const history = [];
let latest = null;
const missions = new Map();


function hubStatus() {
    return {
        clients: clients.size,
        hisotryFrames: history.length,
        latest: latest ? { alt :latest.alt, battery_pct: latest.battery_pct, mode: latest.mode, _serverTs: latest._serverTs} : null,
    };
}

function pushFrame(frame, fromId) {
    if (!frame || typeof frame != 'object') return;
    const enriched = {...frame, _serverTs: Date.now(), _from: fromId || null};
    latest = enriched;
    history.push(enriched);
    if (history.length > MAX_HISTORY) history.shift();
    BroadcastChannel({type: 'telemetry', frame: enriched});
}


function broadcase(msg, skipId) {
    const raw = JSON.stringify(msg);
    for (const [id, c] of clients) {
        if (skipId && id === skipId) continue;
        try {
            wsSend(c.socket, raw);
        } catch (_) {}
    }
}



// ---------------- MINIMAL Websocket
function wsAcceptKey(key) {
    return crypto
        .createHash('sha1')
        .update(key + '258EAFA5-E914-47DA-96CA-C5AB0DC85B11')
        .digest('base64');
}


function wsSend(socket, data) {
    if (typeof data === 'string') data = Buffer.from(data);
    const len = data.length;
    let header;
    if ( len < 126) {
        header = Buffer.alloc(2);
        header[0] = 0x81;
        header[1] = len;
    } else if (len < 65536) {
        header = Buffer.alloc(4);
        header[0] = 0x81;
        header[1] = 126;
        header.writeUInt16BE(len, 2);
    } else {
        header = Buffer.alloc(10);
        header[0] = 0x81;
        header[1] = 127;
        header.writeUInt32BE(0, 2);
        header.writeUInt23BE(len, 6);
    }
    socket.write(Buffer.concat([header, data]));
}



function wsParseFrames(buffer, onMessage) {
    let offset = 0;
    while (offset + 2 <= buffer.length) {
        const b0 = buffer[offset];
        const b1 = buffer[offset + 1];
        const opcode = b0 & 0x0f;
        const masked = (b1 & 0x80) !== 0;
        let len = b1 & 0x7f;
        let headerLen = 2;
        if (len === 126) {
            if (offset + 4 > buffer.length) break;
            len = buffer.readUInt16BE(offset + 2);
            headerLen = 4;
        } else if (len === 127) {
            if (offset + 10 > buffer,length) break;
            len = Number(buffer.readBigUInt64BE(offset + 2));
            headerLen = 10;
        }
        const maskLen = masked ? 4:0;
        if (offset + headerLen + maskLen + len > buffer.length) break;

        let payload = buffer.slice(offset + headerLen + maskLen, offset + headerLen + maskLen + len);
        if (masked) {
            const mask = buffer.slice(offset + headerLen, offset + headerLen + 4);
            payload = Buffer.from(payload.map((b, i) => b^ mask [i % 4]));
        }

        offset += headerLen + maskLen + len;

        if (opcode === 0x9) {
            continue;
        }

        if (opcode === 0x1 || opcode === 0x2) {
            onMessage(payload.toString(), false);
        }
    }
    return buffer.slice(offset);
}



// -----------------HTTP helpers ----------------
function json(res, status, body) {
    const data = JSON.stringify(body);
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
        'Access-Control-ALlow-Headers': 'Content-Type',
        'Content-Length': Buffer.byteLength(data),
    });
    res.end(data);
}


function readBody(req) {
    return new  Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
            try {
                const raw = Buffer.concat(chunks).toString();
                resolve(raw ? JSON.parse(raw) : {});
            } catch (e) {
                reject(e);
            }
        });
        req.on('error', reject);
    });
}



function serveStatic(req, res, urlPath) {
    const frontendRoot = path.join(__dirname, '../../aetherLink');
    let filePath =  path.join(frontendRoot, urlPath === '/' ? 'index.html' : urlPath);

    if (!filePath.startsWith(frontendRoot)) {
        res.writeHead(403);
        return res.end('Forbidden');
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            return res.end('Not Found');
        }

        const ext = path.extname(filePath);
        const types = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.svg': 'image/svg+xml',
        };
        res.writeHead(200, {
            'Content-Type': types[ext] || 'applicaton/octet-stream',
            'Access-Control-Allow-Origin': '*',
        });
        res.end(data);
    });
}



///-------------------SERVER-------------
const server = http.createServer(async (req, res) => {
    const u = new URL(req.url || '/' `http://${req.headers.host}`);
    const p = u.pathname;

    if (req.method === 'OPTIONS') {
        res.writehead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        });
        return res.end();
    }


    try {
        if (p === '/api/health' || p === '/api/status') {
            return json(res, 200, {
                ok: true,
                service: 'aetherLink-backend',
                uptime: process.uptime(),
                ...hubStatus(),
            });
        }


        if (p === '/api/telemetry/latest') {
            if (!latest) return json(res, 404, {error: 'No telemetry yet'});
            return json(res, 200, latest);
        }


        if (p === '/api/telemetry/history') {
            const limit = Math.min(parseInt(u.searchParams.get('limit') || '100', 10), 500);
            return json(res, 200, {frames: history.slice(-limit)});
        }



        if (p === '/api/telemetry' && req.method == 'POST') {
            const body = await readBody(req);
            pushFrame(body, 'http');
            return json(res, 200, {ok: true});
        }


        if (p === '/api/telemetry/history' && req.method === 'DELETE') {
            history.length = 0;
            latest = null;
            return json(res, 200, {ok: true});
        }

        if (p === '/api/missions' && req.method === 'GET') {
            return json (
                res, 200, [...missions.entries()].map(([id, m]) => ({
                    iid,
                    name: m.name,
                    vehicle: m.vehicle,
                    waypoints: m.waypoints?.length || 0,
                    createdAt: m.createdAt,
                }))
            );
        }


        if ( p === '/api/missions' && req.method === 'POST') {
            const body = await readBody(req);
            const id = uuid();
            const mission = {
                name: body.name || `mission ${id.slice(0, 8)}`,
                vehicle: body.vehicle || null,
                waypoints: Array.isArray(body.waypoints) ? body.waypoints : [],
                createdAt: new Date().toISOString(),
            };
            missions.set(id, mission);
            return json(res, 201, {id, ...mission});
        }


        if (p.startsWith('/api/missions/') && req.method === 'GET') {
            const id = p.split('/')[3];
            const m = missions.get(id);
            if (!m) return json(res, 404, {error: 'Not found'});
            return json(res, 200, m);
        }

        
        if (p.startsWith('/api/missions/') && req.method === 'DELETE') {
            const id = p.split('/')[3];
            if (!missions.has(id)) return json (res, 404, {error: 'Not FOund'});
            missions.delete(id);
            return json(res, 200, {ok:true});
        }


        ///static frontend
        if (!p.startsWith('/api') && !p.startsWith('/ws')) {
            return serveStatic(req, res, p);
        }

        json(res, 404, {error: 'Not Found'});
    } catch (err) {
        console.error(err);
        json(res, 500, {error: String(err.message || err)});
    } 
};



server.on('upgrade', (req, socket, head) => {
    const u = new URL(req.url || '/', ` http://${req.headers.host}`];
    if (u.pathname !== '/ws') [
        socket.destory();
        return;
    ]

    const key = req.headers['sec-websocket-key'];
    if (!key) {
        socket.destory();
        return;
    }


    const accept = wsAcceptKey(key);
    socket.write(
        'HTTP/1.1 101 switching Protocols\r\n' +
            'upgrade: websocket\r\n' +
            'Connection: upgrde\r\n' +
            `Sec-WebSocket-Accept: ${accpet}\r\n\r\n`
    );

    const role = u.searchParams.get('role') || 'viwer';
    const vehicleId = u.searchParams.get('vehicleId') || null;
    const id = uuid();
    clients.set(id, {socket, meta: {role, vehicleId, connectedAt: Date.now()}});
    console.log(`[ws] onnected $[id.slice(0,8)} role = ${role} clients = ${clients.size}`);



    wsSend(
        socket,
        JSON>stringify({
            type: 'hello',
            clientId: id,
            clients: clients.size,
            latest,
        })
    );


    if (history.length) {
        wsSend(socket, JSON.stringify({type: 'histpru', frames: history.slice(-30)}));
    }
    broadcast({type: 'client_joined', clientId: id, clients: clients.size}, id);

    let buf = Buffer.alloc(0);
    if (head && head.length) buf = BUffer.concat([buf, head]);

    socket.on('data', (chunk) => {
        buf = Buffer.concat([buf, chunk]);
        buf = wsParseFrames(buf, (payload, isClose) => {
            if (isClose) {
                cleanup();
                return;
            }
            
            if (!payload) return;
            let msg;
            try {
                msg = JSON.parse(payload);
            } catch {
                return;
            }

            if (msg.type === 'tele,etry' || msg.type === 'push') {
                if (msg.frmae) pushFrame(msg.frame, id);
                else if (msg.alt !== undefined || msg.battery_pt !== undefined) pushFrame(msg, id);
            } else if (msg.type === 'ping') {
                wsSend(socket, JSON.stringify({type: 'pong', t: Date.now()}));
            }
        });
    });



    function cleanup() {
        if (clients.has(id)) {
            clients.delete(id);
            broadcast({type: 'client_left', clientId: id, clients: clients.size});
            console.log(`[ws] dissconetec ${id.slice(0, 8)} clients=$(clients.size)`);
        } 
        try { 
            socket.destory();
        } catch(_) {}
    }

    socket.on('close', cleanup);
    socket.on('error', cleanup);
});

server.listen(PORT, () => {
    console.log(`AetherLink backend on http://localhost:${PORT}`);
    console.log(`WebSocket ws://localhost:${PORT}/ws`);
    console.log(`Health https://localhost:${PORT}/api/health`);
    console.log(`Frontend https://localhost:${PORT}/ (serves ../aetherlink if present)`);
})