import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';

const candidateArgument = process.argv[2];
if (!candidateArgument) {
  throw new Error('Usage: node scripts/serve-snapshot-candidate.mjs <candidate-directory>');
}

const root = path.resolve(candidateArgument);
const port = Number.parseInt(process.env.HLTB_ACCEPTANCE_PORT ?? '8765', 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('HLTB_ACCEPTANCE_PORT must be an integer between 1 and 65535');
}

const contentTypes = new Map([
  ['.json', 'application/json; charset=utf-8'],
  ['.pack', 'application/octet-stream'],
  ['.sig', 'text/plain; charset=utf-8'],
]);

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);
    const relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '');
    const filePath = path.resolve(root, relativePath);
    const relative = path.relative(root, filePath);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      response.writeHead(404).end('Not found');
      return;
    }
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error('Not a file');
    response.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
      'Content-Length': info.size,
      'Content-Type': contentTypes.get(path.extname(filePath)) ?? 'application/octet-stream',
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { 'Access-Control-Allow-Origin': '*' }).end('Not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Serving ${root}`);
  console.log(`Snapshot URL: http://127.0.0.1:${port}/stable.json`);
});
