const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const webRoot = process.cwd();
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logsDir = path.resolve(webRoot, '../../docs/courses/web-development/release-logs');
fs.mkdirSync(logsDir, { recursive: true });
const logFile = path.join(logsDir, `course-seed-release-${timestamp}.log`);

const apply = process.argv.includes('--apply');
const skipTests = process.argv.includes('--skip-tests');
const skipVerify = process.argv.includes('--skip-verify');

const steps = [
  { name: 'Validate payload', cmd: ['npm', ['run', 'db:seed:course:validate']] },
  ...(skipTests ? [] : [{ name: 'Payload integration tests', cmd: ['npm', ['run', 'test:integration:course-seed-payload']] }]),
  { name: 'Promote dry-run', cmd: ['npm', ['run', 'db:seed:course:promote:dry']] },
  ...(apply ? [{ name: 'Promote apply', cmd: ['npm', ['run', 'db:seed:course:promote']] }] : []),
  ...((apply && !skipVerify) ? [{ name: 'Verify live state', cmd: ['npm', ['run', 'db:seed:course:verify']] }] : []),
];

function write(msg) {
  fs.appendFileSync(logFile, msg + '\n');
  process.stdout.write(msg + '\n');
}

function runStep(step) {
  write(`\n=== ${step.name} ===`);
  const [bin, args] = step.cmd;
  const res = spawnSync(bin, args, { stdio: 'pipe', encoding: 'utf8', cwd: webRoot, env: process.env });

  if (res.stdout) write(res.stdout.trimEnd());
  if (res.stderr) write(res.stderr.trimEnd());

  if (res.status !== 0) {
    write(`\n[FAILED] ${step.name} (exit ${res.status})`);
    write(`[LOG] ${logFile}`);
    process.exit(res.status || 1);
  }

  write(`[OK] ${step.name}`);
}

write('COURSE SEED RELEASE ORCHESTRATOR');
write(`Mode: ${apply ? 'APPLY' : 'DRY-RUN ONLY'}`);
write(`Log: ${logFile}`);

for (const step of steps) runStep(step);

write('\n[SUCCESS] Course seed release workflow completed.');
write(`[LOG] ${logFile}`);
