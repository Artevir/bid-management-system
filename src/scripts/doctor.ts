import fs from 'fs';
import path from 'path';
import dns from 'dns';

function maskDbUrl(value?: string) {
  if (!value) return '';
  try {
    const url = new URL(value);
    const passwordMasked = url.password ? '***' : '';
    const username = url.username || '';
    const auth = username ? `${username}:${passwordMasked}@` : '';
    return `${url.protocol}//${auth}${url.host}${url.pathname}${url.search}`;
  } catch {
    return value.replace(/:[^:@/]+@/, ':***@');
  }
}

function normalizeEnvUrlLike(value?: string) {
  const v = value?.trim().replace(/^[`'"]+|[`'"]+$/g, '');
  return v ? v.replace(/\/+$/, '') : undefined;
}

function findReturnNaN(searchRoot: string) {
  const results: string[] = [];
  const stack: string[] = [searchRoot];
  while (stack.length) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        try {
          const content = fs.readFileSync(full, 'utf8');
          if (content.includes('returnNaN')) results.push(full);
        } catch {
          continue;
        }
      }
    }
  }
  return results;
}

const cwd = process.cwd();
const nextServerDir = path.join(cwd, '.next', 'server');

async function resolveHost(host?: string) {
  if (!host) return [];
  try {
    const results = await dns.promises.lookup(host, { all: true });
    return results.map(r => r.address);
  } catch {
    return [];
  }
}

function extractHost(value?: string) {
  const normalized = normalizeEnvUrlLike(value);
  if (!normalized) return undefined;
  try {
    const url = normalized.startsWith('http://') || normalized.startsWith('https://')
      ? new URL(normalized)
      : new URL(`http://${normalized}`);
    return url.hostname;
  } catch {
    const host = normalized.split('/')[0];
    return host || undefined;
  }
}

async function main() {
  const lines: string[] = [];
  lines.push(`node=${process.version}`);
  lines.push(`node_env=${process.env.NODE_ENV || ''}`);
  lines.push(`pm2_home=${process.env.PM2_HOME || ''}`);
  lines.push(`database_url=${maskDbUrl(process.env.DATABASE_URL)}`);
  lines.push(`cookie_secure=${process.env.COOKIE_SECURE || ''}`);
  lines.push(`coze_project_domain_default=${normalizeEnvUrlLike(process.env.COZE_PROJECT_DOMAIN_DEFAULT) || ''}`);
  lines.push(`oss_endpoint=${normalizeEnvUrlLike(process.env.OSS_ENDPOINT) || ''}`);
  lines.push(`coze_bucket_endpoint_url=${normalizeEnvUrlLike(process.env.COZE_BUCKET_ENDPOINT_URL) || ''}`);

  const hostCandidates = [
    ['coze_project_domain_default_host', extractHost(process.env.COZE_PROJECT_DOMAIN_DEFAULT)],
    ['oss_endpoint_host', extractHost(process.env.OSS_ENDPOINT)],
    ['coze_bucket_endpoint_host', extractHost(process.env.COZE_BUCKET_ENDPOINT_URL)],
  ] as const;

  for (const [label, host] of hostCandidates) {
    if (!host) continue;
    const addrs = await resolveHost(host);
    lines.push(`${label}=${host}`);
    for (const addr of addrs) lines.push(`${label}_addr=${addr}`);
  }

const writeTargets = [
  path.join(cwd, '.next'),
  path.join(cwd, 'node_modules'),
];

for (const target of writeTargets) {
  try {
    fs.mkdirSync(target, { recursive: true });
    const probe = path.join(target, '.doctor_write_test');
    fs.writeFileSync(probe, String(Date.now()));
    fs.unlinkSync(probe);
    lines.push(`write_ok=${target}`);
  } catch (e) {
    lines.push(`write_fail=${target} ${(e as Error).message}`);
  }
}

if (fs.existsSync(nextServerDir)) {
  const hits = findReturnNaN(nextServerDir);
  lines.push(`returnNaN_hits=${hits.length}`);
  for (const hit of hits.slice(0, 20)) lines.push(`returnNaN_file=${hit}`);
} else {
  lines.push('returnNaN_hits=0');
}

  process.stdout.write(lines.join('\n') + '\n');
}

main();
