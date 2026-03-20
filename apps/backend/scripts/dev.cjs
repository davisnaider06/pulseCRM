const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const appDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(appDir, '..', '..');
const envPath = path.join(rootDir, '.env');

loadEnvFile(envPath);

const backendPort = parsePort(process.env.BACKEND_PORT, 3001);
const backendPathHint = appDir.toLowerCase();

ensurePortIsAvailable({
  port: backendPort,
  appLabel: 'backend',
  processMatchers: ['apps\\\\backend', 'apps/backend', 'backend\\\\dist\\\\main', 'backend/dist/main'],
  pathHint: backendPathHint,
});

runCommand('npm', ['run', 'prisma:generate'], appDir);
runCommand('npm', ['run', 'start:dev:nest'], appDir);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/u);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();

    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function parsePort(value, fallback) {
  const parsed = Number.parseInt(value ?? `${fallback}`, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function ensurePortIsAvailable({ port, appLabel, processMatchers, pathHint }) {
  if (process.platform !== 'win32') {
    return;
  }

  const inspectResult = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess`,
    ],
    {
      cwd: appDir,
      encoding: 'utf8',
    },
  );

  const pid = inspectResult.stdout.trim();

  if (inspectResult.status !== 0 && !pid) {
    return;
  }

  if (!pid) {
    return;
  }

  const processResult = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `(Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}").CommandLine`,
    ],
    {
      cwd: appDir,
      encoding: 'utf8',
    },
  );

  const commandLine = processResult.stdout.trim().toLowerCase();
  const isSameApp = processMatchers.some((matcher) => commandLine.includes(matcher.toLowerCase()))
    || commandLine.includes(pathHint);

  if (!isSameApp) {
    console.error(`A porta ${port} ja esta em uso por outro processo (PID ${pid}).`);
    console.error(`Libere a porta ou altere BACKEND_PORT no arquivo ${envPath}.`);
    process.exit(1);
  }

  console.log(`Encerrando processo antigo do ${appLabel} na porta ${port} (PID ${pid})...`);

  const stopResult = spawnSync(
    'powershell',
    ['-NoProfile', '-Command', `Stop-Process -Id ${pid} -Force -ErrorAction Stop`],
    {
      cwd: appDir,
      stdio: 'inherit',
    },
  );

  if (stopResult.status !== 0) {
    console.error(`Nao foi possivel encerrar o processo antigo do ${appLabel}.`);
    process.exit(stopResult.status ?? 1);
  }

  waitForPortToBeReleased(port);
}

function runCommand(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function waitForPortToBeReleased(port) {
  const timeoutAt = Date.now() + 10000;

  while (Date.now() < timeoutAt) {
    const checkResult = spawnSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess`,
      ],
      {
        cwd: appDir,
        encoding: 'utf8',
      },
    );

    if (checkResult.status !== 0 && !checkResult.stdout.trim()) {
      return;
    }

    if (!checkResult.stdout.trim()) {
      return;
    }

    sleep(250);
  }

  console.error(`A porta ${port} nao foi liberada a tempo.`);
  process.exit(1);
}

function sleep(milliseconds) {
  const target = Date.now() + milliseconds;

  while (Date.now() < target) {
    // Busy wait is acceptable here because this script only runs during local dev startup.
  }
}
