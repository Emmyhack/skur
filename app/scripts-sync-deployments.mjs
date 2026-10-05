// Copy sui/deployments/*.json into the app, so the published addresses are configured in exactly
// one place and the app does not import across the workspace boundary.
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

const from = new URL('../sui/deployments/', import.meta.url);
const to = new URL('./src/config/deployments.json', import.meta.url);

const out = {};
try {
  for (const file of await readdir(from)) {
    if (!file.endsWith('.json')) continue;
    const body = JSON.parse(await readFile(new URL(file, from), 'utf8'));
    out[body.network ?? file.replace('.json', '')] = body;
  }
} catch {
  console.log('no deployments yet; leaving the committed defaults in place');
  process.exit(0);
}

await mkdir(new URL('./src/config/', import.meta.url), { recursive: true });
await writeFile(to, `${JSON.stringify(out, null, 2)}\n`);
console.log(`wrote ${Object.keys(out).join(', ') || 'nothing'}`);
