import { spawn } from 'node:child_process';
export function docker(args: string[], input?: string, env?: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, {
      env: env || process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let output = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Docker operation timed out'));
    }, 120000);
    child.stdout.on('data', (data: Buffer) => {
      output += data.toString();
      if (output.length > 1000000) child.kill('SIGKILL');
    });
    // Never propagate Docker stderr: it can contain configuration or provider credentials.
    child.stderr.on('data', (data: Buffer) => {
      if (process.env.COLMEIA_DOCKER_DIAGNOSTICS === '1')
        console.error(data.toString().replace(/[a-f0-9]{64}|sk-[A-Za-z0-9_-]+/gi, '[redacted]'));
    });
    child.on('error', () => {
      clearTimeout(timer);
      reject(new Error('Docker unavailable'));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(output.trim());
      else reject(new Error(`Docker ${args[0]} failed (exit ${code})`));
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}
export async function exists(kind: 'container' | 'network' | 'volume', name: string) {
  try {
    await docker([kind, 'inspect', name]);
    return true;
  } catch {
    return false;
  }
}
