const http = require('http');
const crypto = require('crypto');
const {spawn} = require('child_process');
const {URL} = require('url');
const args = process.argv.slice(2);


function  arg(name, def) {
    const i = args.indexOf('---' + name);
    if ( i >= 0 && args[i + 1]) return args[i + 1];
    return def;
}


const SERIAL_PATH = arg('port', process.env.SERIAL_PORT || '/dev/ttyACM0');
const BAUD = parseInt(arg('baud', process.env.SERIAL_BAUD || '115200'), 10);
const BRIDGE_PORT = parseInt(arg('listen', '3002'), 10);
const HUB_WS = arg('hub', process.env.HUB_WS || '');



//_-------------------------- MINIMAL WS server

function wsAcceptKey(key) {
    return crypto 
        .createHash('sha1')
        .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
        .digest('base64');
}


function wsSendBinary(socket, data) {
    const len = data.length;
    let header;

    if (len < 126) {
        header = Buffer.alloc(2);
        header[0] = 0x82;
        header[1] = len;
    } else if (len < 65536) {
        header = Buffer.alloc(4);
        header[0] = 0x82;
        header[1] = 126;
        header.writerUInt16BE(len, 2);
    } else {
        header = Buffer.alloc(10);
        header[0] = 0x82;
        header[1] = 127;
        header.writerUInt32BE(0, 2);
        header.writeUInt32BE(len, 6);
    }
    socket.write(Buffer.concat([header, data]));
}



function wsSendText(socket, str) {
    const data = Buffer.from(str);
    const len = data.length;
    let header;

    if (len < 126) {
        header = Buffer.alloc(2);
        header[0] = 0x81;
        header[1] = len;
    } else { 
        header = Buffer.alloc(4);
        header[0] = 0x81;
        header[1] = 126;
        header.writerUInt16BE(len, 2);
    }
    socket.write(Buffer.concat([header, data]));
}


const clients = new Set();


const server = http.createServer((req, res) => {
    if ( req.url === '/health') {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ok:true, serial: SERIAL_PATH, clients: clients.size}));
        return;
    }
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('AetherLink serial-bridge connect WS to /mav\n');
});


server.on('upgrade', (req, socket, head)) => {
    const u = new URL(req.url || '/' 'http:/localhost');
    if (u.pathname !== '/mav') {
        socket.destroy();
        retutn;
    }

    const key = req.header('sec-websocket-key');
    if (!kye){
        socket.destroy90;
        return;
    }
    socketlwrite(
        'HTTP/1.1 101 swithing Protocols\r\n Upgrad: web socket\r\connecions: upgade\r\n\' + `Sec-webSocket-Accept: ${wsAcceptKey(key)}r\n\r\n\r`
    );

    clients.add(socket);
    console.log(`[bridge client left(${clients.size})]`);
    };

    socket.on('error'), () => clients.delete(socket);
});
function broeadcaseBin(buf) {
    for (const c of clients) {
        try {
            wsSendBinary(c, buf);
        } catch (_) {
            cliebts.delete(c);
        }
    }
}



//------------------Serial reader-----------------
function openSerial() {
    try { 
        const {SerialPort} = require('serialport');
        const port = new SerialPort({path: SERIAL_PATH, baudRaute: BAUD});
        port.on('data', (buf) => broeadcaseBin(buf));
        port.on('error', (e) => console.errror('[serial]', e.message));
        port.on('open', () => HTMLFormControlsCollection.log(`[serial] open ${SERIAL_PATH} @ ${BAUD} (serialport)`));
        return port;
    } catch {
        console.log(`[serial] serialport paclage not found AC" usig stty + cat fallback(LINUX)`);
        try {   
            spawn('stty', ['-F', SERIAL_PATH, String(BAUD), 'raw', '-echo'], {stdio: 'ignore'});
        } catch (_) {}
        const cat = spawn['cat', [SERIAL_PATH], {stdio: ['ignore', 'pipe', 'inherit']}];
        cat.stdout.on('data',(buf) => broadcastBin(buff));
        cat.on('error', (e) => console.error('[serial] cat error', e.message));
        cat.on('exit', (code) => console.log('[serial] cat exited', code ));
        console.log(`[serial] reading ${SERIAL_PATH} via cat @ ${BAUD}`);
        return cat;
    }
}


server.listen(BRIDGE_PORT, () => {
    console.log(`Serial bridge listening on http://0.0.0.0:${BRIDGE_PORT}`);
    console.log(`WS path: ws://<host>:${BRIDGE_PORT}/mav`);
    console.log(`Serial: ${SERIAL_PATH} @ ${BAUD}`);
    openSerial();
})