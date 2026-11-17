import app from './app';
import { scheduled } from './scheduled';

// HTTP goes to the Hono app; the cron trigger runs the cache retention (see `scheduled.ts`).
export default { fetch: app.fetch, scheduled };
