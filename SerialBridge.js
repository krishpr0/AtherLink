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
)