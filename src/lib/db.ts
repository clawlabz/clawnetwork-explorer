import { Pool } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.EXPLORER_DATABASE_URL;
    if (!connectionString) {
      throw new Error("EXPLORER_DATABASE_URL not configured");
    }
    pool = new Pool({ connectionString, max: 5 });
  }
  return pool;
}

export async function query<T extends Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const client = await getPool().connect();
  try {
    const result = await client.query(text, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}
