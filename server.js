const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const {WebSocketServer} = require('ws');
const {TelemetryHub} = require('./TelemetryHub');
const PORT = process.env.PORT || 3001;
const hub = new TelemetryHub();
const app = express();
app.use(cors());
app.use(express.json({limit: '2mb'}));

const frontendPath = path.join(__dirname, '../../aetherlink');
app.use(express.static(frontendPath));

// --------------- REST API ---------------

app.get('/api/health', (_req, res) => {
    res.json({
        ok:true,
        service: 'aether-link-backend',
        uptime: process.uptime(),
        ...hub.getStatus(),
    });
});


app.get('/api/status', (_req, res) => {
    res.json(hub.getStatus());
});


app.get('/api/telemetry/latest', (_req, res) => {
    const latest = hub.getLatest();
    if (!latest) return res.status(404).json({error: 'No Telemetry yet'});
    res.json(latest);
});


app.get('/api/telemetry/history', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    res.json({frames: hub.getHistory(limit)});
});


app.post('/api/telemetry', (req, res) => {
    const frame = req.body;
    if (!frame || typeof frame !== 'object') {
        return res.status(400).json({error: 'Expecte JSON frame'});
    }
    hub.push(frame, 'http');
    res.json({ok: true});
});


app.delete('/api/telemetry/history', (_req, res) => {
    hub.clearHistory();
    res.json({ok:true});
});


//SIMPLE MISSIN STORAGE
const missions = new Map();

app.get('/api/missions', (_req, res) => {
    res.json([...missions.entries()].map(([id, m]) => ({id, ...m, waypoints: m.waypoints?.length || 0})));
});


app.get('/api/missions/:id', (req, res) => {
    const m = missions.get(req.params.id);
    if (!m) return res.status(404).json({error: 'Not Found'});
    res.json(m);
});


app.post('/api/missions', (req, res) => {
    const { name, waypoints, vehicle} = req.body || {};
    const id = require('uuid').v4();
    const mission =  {
        name: name ||` MISSION ${id.slice(0, 8)}`,
        vehicle: vehicle || null,
        waypoints: Array.isArray(waypoints) ? waypoints : [],
        createdAt: new Date().toISOString(),
    };
    missions.set(id, mission);
    res.status(201).json({id, ...missinos});
});



app.delete('/api/missions/:id', (req, res) => {
    if (!missinos.has(req.params.id)) return res.status(404).json({error:'Not found'});
    missions.delete(req.params.id);
    res.json({ok:true});
});



/// ------------ HTTP SERVER + WEbSOCKET 0---------------------
const  server = http.createServer(app);

const was = new WebSocketServer({server, path:'/ws'});

wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const role = url.searchParams.get('role') || 'viwer';
    const vehicleId = url.searchParams.get('vehicleId') || null;

    const clientId = hub.addClient(ws, {role, vehicleId});
    console.log(`[ws] connected ${clientId} role = ${role} clients=${hub.clients.size}`);

    ws.on('message', (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw.toString());
        } catch {
            return;
        }

        switch (msg.type) {
            case 'telemetry':
                case 'push':

                if (msg.frame) hub.push(msg.frame, clientId);
                else if (msg.alt !== undefined || msg.battery_pct !== undefined) {
                    hub.push(msg, clientId);
                }
                break;


                case 'ping':
                    hub._send(ws, {type: 'pong', t: Date.now()});
                    break;

                case 'subscribe':
                    hub._send(ws, {type: 'subscribed', clientId});
                    break;

                default: 
                break;
        }
    });

    ws.on('close', () => {
        hub.removeClient(ws);
        console.log(`[ws] disconnected ${clientId} client = ${hub.clients.size}`);
    });


    ws.on('error', () => {
        hub.removeClient(ws);
    });
});


server.listen(PORT, () => {
    console.log(`AetherLink backend listening on http://localhost:${PORT}`);
    console.log(`WebSocket: ws://localhost:${PORT}/ws`);
    console.log(`Health: http://localhost:${PORT}/api/health`);
});