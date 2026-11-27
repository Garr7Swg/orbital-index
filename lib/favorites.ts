import { db, ensureSchema, hasDatabase } from "./db";

export async function listFavorites(userId: string): Promise<string[]> {
  if (!hasDatabase()) return [];
  try {
    await ensureSchema();
    const rows = await db()<{ launch_id: string }[]>`
      select launch_id from favorites where user_id = ${userId} order by created_at desc limit 200
    `;
    return rows.map((r) => r.launch_id);
  } catch {
    return [];
  }
}

export async function addFavorite(userId: string, launchId: string): Promise<boolean> {
  if (!hasDatabase()) return false;
  await ensureSchema();
  await db()`
    insert into favorites (user_id, launch_id) values (${userId}, ${launchId})
    on conflict do nothing
  `;
  return true;
}

export async function removeFavorite(userId: string, launchId: string): Promise<boolean> {
  if (!hasDatabase()) return false;
  await ensureSchema();
  await db()`delete from favorites where user_id = ${userId} and launch_id = ${launchId}`;
  return true;
}
