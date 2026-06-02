// {{AGENT_NAME}} — step functions
// Steps have full Node.js access. Add your business logic here.

/**
 * Example step: fetch external data.
 * Steps are automatically retried on failure and their results are persisted.
 */
export async function exampleFetch(url: string): Promise<string> {
  'use step';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}
