import fs from 'fs';
import path from 'path';

type CheckResult = {
  ok: boolean;
  name: string;
  detail?: string;
};

function envRequiredCheck(): CheckResult[] {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'CRON_SECRET', 'E_SIGN_CALLBACK_SECRET'];
  return required.map((key) => ({
    ok: Boolean(process.env[key]),
    name: `env:${key}`,
    detail: process.env[key] ? undefined : 'missing',
  }));
}

function buildArtifactsCheck(cwd: string): CheckResult[] {
  const standalone = path.join(cwd, '.next', 'standalone', 'server.js');
  const staticDir = path.join(cwd, '.next', 'static');
  return [
    {
      ok: fs.existsSync(standalone),
      name: 'artifact:standalone-server',
      detail: standalone,
    },
    {
      ok: fs.existsSync(staticDir),
      name: 'artifact:next-static',
      detail: staticDir,
    },
  ];
}

function main() {
  const cwd = process.cwd();
  const results: CheckResult[] = [
    ...envRequiredCheck(),
    ...buildArtifactsCheck(cwd),
  ];

  const failed = results.filter((r) => !r.ok);
  for (const item of results) {
    const mark = item.ok ? 'PASS' : 'FAIL';
    const suffix = item.detail ? ` (${item.detail})` : '';
    console.log(`[${mark}] ${item.name}${suffix}`);
  }

  if (failed.length > 0) {
    console.error(`\nRelease gate failed: ${failed.length} check(s) not passed.`);
    process.exit(1);
  }

  console.log('\nRelease gate passed.');
}

main();
