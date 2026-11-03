import http from 'node:http';
import {handler} from './server.mjs';
const port=Number(process.env.PORT||4173);
const host=process.env.HOST||'127.0.0.1';
http.createServer(handler).listen(port,host,()=>console.log(`NOVA local: http://${host}:${port}`));
