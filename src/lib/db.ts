import { Pool } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.EXPLORER_DATABASE_URL;
    if (!connectionString) {
      throw new Error("EXPLORER_DATABASE_URL not configured");
    }
    // Strip sslmode from URL to prevent pg driver from overriding our ssl config
    const cleanUrl = connectionString.replace(/[?&]sslmode=[^&]*/g, "").replace(/\?$/, "");
    const needsSsl = connectionString.includes("sslmode=require") || connectionString.includes("ssl=true");
    pool = new Pool({
      connectionString: cleanUrl,
      max: 5,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    });
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
