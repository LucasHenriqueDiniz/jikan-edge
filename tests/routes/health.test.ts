import { describe, expect, it } from 'vitest';
import app from '../../src/app';
describe('health route', () => { it('responds without storage', async () => { const response = await app.request('http://localhost/health'); expect(response.status).toBe(200); expect(((await response.json()) as { data: { status: string } }).data.status).toBe('ok'); }); });
