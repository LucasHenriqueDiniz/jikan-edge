import { z } from 'zod';
import type { UserFriend } from '../domain/user-social';
import { decodeHtml, imageFrom } from './html';

const friendSchema = z.object({
  username: z.string().min(1),
  imageUrl: z.string().url().nullable(),
  lastOnline: z.string().nullable(),
  friendsSince: z.string().nullable(),
});

export function parseUserFriends(html: string): UserFriend[] {
  const container = html.match(/class="boxlist-container friend[\s\S]*$/i)?.[0] ?? '';
  const friends: UserFriend[] = [];
  const seen = new Set<string>();
  for (const block of container.split('class="boxlist col-3"').slice(1)) {
    const username = block.match(/<div class="title"><a href="https:\/\/myanimelist\.net\/profile\/([^"]+)">/i)?.[1];
    if (!username || seen.has(username)) continue;
    seen.add(username);
    const imageUrl = imageFrom(block);
    const greyBits = [...block.matchAll(/<div class="di-ib mt4 fn-grey2">\s*([\s\S]*?)\s*<\/div>/gi)].map((match) => decodeHtml(match[1]));
    const friendsSince = greyBits.find((bit) => bit.startsWith('Friends since'))?.replace(/^Friends since\s*/i, '') ?? null;
    const lastOnline = greyBits.find((bit) => !bit.startsWith('Friends since')) ?? null;
    const candidate = { username: decodeHtml(username), imageUrl, lastOnline, friendsSince };
    const parsed = friendSchema.safeParse(candidate);
    if (parsed.success) friends.push(parsed.data);
  }
  return friends;
}
