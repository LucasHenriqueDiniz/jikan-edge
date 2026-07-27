export class RefreshLockRepository {
  constructor(private readonly db: D1Database) {}

  async acquire(resourceKey: string, owner: string, leaseSeconds = 30): Promise<boolean> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + leaseSeconds * 1_000).toISOString();
    const result = await this.db.prepare(`INSERT INTO refresh_leases(resource_key, owner, acquired_at, expires_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(resource_key) DO UPDATE SET owner=excluded.owner, acquired_at=excluded.acquired_at, expires_at=excluded.expires_at
      WHERE refresh_leases.expires_at < ?`).bind(resourceKey, owner, now.toISOString(), expiresAt, now.toISOString()).run();
    return (result.meta.changes ?? 0) > 0;
  }

  async release(resourceKey: string, owner: string): Promise<void> {
    await this.db.prepare('DELETE FROM refresh_leases WHERE resource_key = ? AND owner = ?').bind(resourceKey, owner).run();
  }
}
