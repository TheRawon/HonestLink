import { spawn } from 'node:child_process';

const children = [];

const spawnChild = (command, args) => {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: true,
  });
  children.push(child);
  return child;
};

const shutdown = () => {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

spawnChild('node', ['scripts/demo-api.mjs']);
spawnChild('npx', ['vite', '--port=3000', '--host=0.0.0.0']);
