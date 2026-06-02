import { spawn } from 'child_process';
import path from 'path';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const { stacks } = await req.json() as { stacks: string[] };

  console.log('[deploy] starting CDK deploy', { stacks });

  const infraPath = path.join(process.cwd(), '..', '..', 'packages', 'infra');
  const stackArgs = stacks.length > 0 ? stacks : ['--all'];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const proc = spawn(
        'npx',
        ['cdk', 'deploy', ...stackArgs, '--require-approval', 'never', '--ci'],
        {
          cwd: infraPath,
          env: { ...process.env, FORCE_COLOR: '0' },
        }
      );

      proc.stdout.on('data', (chunk: Buffer) => {
        controller.enqueue(encoder.encode(chunk.toString()));
      });

      proc.stderr.on('data', (chunk: Buffer) => {
        controller.enqueue(encoder.encode(chunk.toString()));
      });

      proc.on('close', (code) => {
        const msg = code === 0 ? '\n✓ Deploy complete\n' : `\n✗ Deploy failed (exit ${code})\n`;
        controller.enqueue(encoder.encode(msg));
        console.log('[deploy] CDK process exited', { code });
        controller.close();
      });

      proc.on('error', (err) => {
        controller.enqueue(encoder.encode(`\n✗ Failed to start CDK: ${err.message}\n`));
        console.error('[deploy] spawn error', { error: err.message });
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
