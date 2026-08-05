import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const client = path.join(dist, 'client');
const server = path.join(dist, 'server');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(client, 'data'), { recursive: true });
fs.mkdirSync(server, { recursive: true });
fs.mkdirSync(path.join(dist, '.openai'), { recursive: true });

for (const file of ['index.html', 'app.js', 'styles.css', 'research.css']) {
  fs.copyFileSync(path.join(root, file), path.join(client, file));
}
fs.copyFileSync(path.join(root, 'public', 'og.png'), path.join(client, 'og.png'));
fs.copyFileSync(path.join(root, 'public', 'og-strategy-v2.png'), path.join(client, 'og-strategy-v2.png'));
fs.copyFileSync(path.join(root, 'data', 'software-universe.json'), path.join(client, 'data', 'software-universe.json'));
fs.copyFileSync(path.join(root, 'data', 'strategy-registry.json'), path.join(client, 'data', 'strategy-registry.json'));
fs.copyFileSync(path.join(root, '.openai', 'hosting.json'), path.join(dist, '.openai', 'hosting.json'));

const worker = `export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/') {
      return env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request));
    }
    return env.ASSETS.fetch(request);
  }
};
`;
fs.writeFileSync(path.join(server, 'index.js'), worker, 'utf8');
console.log('Static Sites build complete');
