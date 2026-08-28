const CASES = {
  profile: {
    url: 'https://myanimelist.net/profile/amayacrab',
    markers: ["Amayacrab's Profile", 'Anime Stats'],
  },
  'anime-detail': {
    url: 'https://myanimelist.net/anime/1/Cowboy_Bebop',
    markers: ['Cowboy Bebop', 'Synopsis', 'Information'],
  },
  'anime-search': {
    url: 'https://myanimelist.net/anime.php?q=cowboy+bebop&cat=anime',
    markers: ['Search Anime', 'Cowboy Bebop'],
  },
  'top-anime': {
    url: 'https://myanimelist.net/topanime.php',
    markers: ['Top Anime Series', 'Fullmetal Alchemist'],
  },
  'season-now': {
    url: 'https://myanimelist.net/anime/season',
    markers: ['Seasonal Anime', 'Summer 2026'],
  },
  genres: {
    url: 'https://myanimelist.net/anime.php?cat=genre',
    markers: ['Genres', 'Action'],
  },
  'manga-detail': {
    url: 'https://myanimelist.net/manga/2/Berserk',
    markers: ['Berserk', 'Synopsis', 'Information'],
  },
  'manga-search': {
    url: 'https://myanimelist.net/manga.php?q=berserk&cat=manga',
    markers: ['Search Manga', 'Berserk'],
  },
  'top-manga': {
    url: 'https://myanimelist.net/topmanga.php',
    markers: ['Top Manga', 'Berserk'],
  },
  'character-detail': {
    url: 'https://myanimelist.net/character/1/Spike_Spiegel',
    markers: ['Spike Spiegel', 'Animeography', 'Voice Actors'],
  },
  'person-detail': {
    url: 'https://myanimelist.net/people/1',
    markers: ['Tomokazu Seki', 'Voice Acting Roles'],
  },
  'character-search': {
    url: 'https://myanimelist.net/character.php?q=Spike&cat=character',
    markers: ['Search Characters', 'Spike'],
  },
  'people-search': {
    url: 'https://myanimelist.net/people.php?q=Tomokazu&cat=person',
    markers: ['Search People', 'Tomokazu'],
  },
  'top-characters': {
    url: 'https://myanimelist.net/character.php',
    markers: ['Anime & Manga Characters'],
  },
  'top-people': {
    url: 'https://myanimelist.net/people.php',
    markers: ['People', 'Favorites'],
  },
  'producer-detail': {
    url: 'https://myanimelist.net/anime/producer/1/Studio_Pierrot',
    markers: ['Studio Pierrot', 'Companies'],
  },
  'club-detail': {
    url: 'https://myanimelist.net/clubs.php?cid=1',
    markers: ['Cowboy Bebop', 'Members', 'Staff'],
  },
  'airing-collection': {
    url: 'https://myanimelist.net/anime.php?cat=airing',
    markers: ['Airing Anime'],
  },
  'upcoming-season': {
    url: 'https://myanimelist.net/anime/season/later',
    markers: ['Later - Anime'],
  },
  'recent-anime-reviews': {
    url: 'https://myanimelist.net/reviews.php?t=anime',
    markers: ['Anime Reviews', 'review-element'],
  },
  'recent-manga-reviews': {
    url: 'https://myanimelist.net/reviews.php?t=manga',
    markers: ['Manga Reviews', 'review-element'],
  },
  'manga-genres': {
    url: 'https://myanimelist.net/manga.php?cat=genre',
    markers: ['Genres', 'Action'],
  },
  magazines: {
    url: 'https://myanimelist.net/manga/magazine',
    markers: ['Manga Magazines'],
  },
  'anime-episodes': {
    url: 'https://myanimelist.net/anime/1/_/episode',
    markers: ['Cowboy Bebop', 'Episodes'],
  },
  'anime-videos': {
    url: 'https://myanimelist.net/anime/1/_/video',
    markers: ['Cowboy Bebop', 'Watch'],
  },
  'anime-stats': {
    url: 'https://myanimelist.net/anime/1/_/stats',
    markers: ['Cowboy Bebop', 'Statistics'],
  },
  'user-animelist': {
    url: 'https://myanimelist.net/animelist/amayacrab',
    markers: ['Anime List', 'Amayacrab'],
  },
  'user-mangalist': {
    url: 'https://myanimelist.net/mangalist/amayacrab',
    markers: ['Manga List', 'Amayacrab'],
  },
  'user-history': {
    url: 'https://myanimelist.net/profile/amayacrab/history',
    markers: ['History', 'Amayacrab'],
  },
  'user-reviews': {
    url: 'https://myanimelist.net/profile/amayacrab/reviews',
    markers: ['Reviews', 'amayacrab'],
  },
  'user-friends': {
    url: 'https://myanimelist.net/profile/amayacrab/friends',
    markers: ['Friends', 'Amayacrab'],
  },
  'top-anime-reviews-candidate': {
    url: 'https://myanimelist.net/reviews.php?t=anime&filter_check=1&order_by=most_helpful',
    markers: ['Anime Reviews', 'review-element'],
  },
  'recent-anime-recommendations': {
    url: 'https://myanimelist.net/recommendations.php?s=recentrecs&t=anime',
    markers: ['Anime Recommendations', 'recommendation'],
  },
  'recent-manga-recommendations': {
    url: 'https://myanimelist.net/recommendations.php?s=recentrecs&t=manga',
    markers: ['Manga Recommendations', 'recommendation'],
  },
  'anime-detail-recommendations': {
    url: 'https://myanimelist.net/anime/1/Cowboy_Bebop/userrecs',
    markers: ['Cowboy Bebop', 'Recommendations'],
  },
  'manga-detail-recommendations': {
    url: 'https://myanimelist.net/manga/2/Berserk/userrecs',
    markers: ['Berserk', 'Recommendations'],
  },
  'watch-recent-episodes': {
    url: 'https://myanimelist.net/watch/episode',
    markers: ['Watch Videos', 'video-list'],
  },
  'watch-popular-episodes': {
    url: 'https://myanimelist.net/watch/episode/popular',
    markers: ['Watch Videos', 'video-list'],
  },
  'watch-recent-promos': {
    url: 'https://myanimelist.net/watch/promotion?p=1',
    markers: ['Watch Promotional Videos', 'video-list'],
  },
  'watch-popular-promos': {
    url: 'https://myanimelist.net/watch/promotion/popular',
    markers: ['Watch Promotional Videos', 'video-list'],
  },
  'producer-list': {
    url: 'https://myanimelist.net/anime/producer',
    markers: ['Anime Studio', 'Studio Pierrot'],
  },
  'club-members': {
    url: 'https://myanimelist.net/clubs.php?action=view&t=members&id=1&show=0',
    markers: ['Cowboy Bebop', 'Members'],
  },
  'user-clubs': {
    url: 'https://myanimelist.net/profile/ZUKUT0/clubs',
    markers: ['Profile - Clubs', 'clubs.php?cid='],
  },
  'user-recommendations-empty': {
    url: 'https://myanimelist.net/profile/amayacrab/recommendations?p=1',
    markers: ['Profile - Recommendations', 'Amayacrab'],
  },
  'anime-characters': {
    url: 'https://myanimelist.net/anime/1/_/characters',
    markers: ['Cowboy Bebop', 'Characters'],
  },
  'anime-forum': {
    url: 'https://myanimelist.net/anime/1/_/forum',
    markers: ['Cowboy Bebop', 'Forum'],
  },
  'anime-moreinfo': {
    url: 'https://myanimelist.net/anime/1/_/moreinfo',
    markers: ['Cowboy Bebop', 'More Info'],
  },
  'anime-news': {
    url: 'https://myanimelist.net/anime/1/_/news?p=1',
    markers: ['Cowboy Bebop', 'News'],
  },
  'anime-pictures': {
    url: 'https://myanimelist.net/anime/1/jikan/pics',
    markers: ['Cowboy Bebop', 'Pictures'],
  },
  'anime-reviews': {
    url: 'https://myanimelist.net/anime/1/jikan/reviews',
    markers: ['Cowboy Bebop', 'Reviews'],
  },
  'manga-characters': {
    url: 'https://myanimelist.net/manga/2/_/characters',
    markers: ['Berserk', 'Characters'],
  },
  'manga-forum': {
    url: 'https://myanimelist.net/manga/2/_/forum',
    markers: ['Berserk', 'Forum'],
  },
  'manga-moreinfo': {
    url: 'https://myanimelist.net/manga/2/_/moreinfo',
    markers: ['Berserk', 'More Info'],
  },
  'manga-news': {
    url: 'https://myanimelist.net/manga/2/_/news?p=1',
    markers: ['Berserk', 'News'],
  },
  'manga-pictures': {
    url: 'https://myanimelist.net/manga/2/jikan/pics',
    markers: ['Berserk', 'Pictures'],
  },
  'manga-reviews': {
    url: 'https://myanimelist.net/manga/2/jikan/reviews',
    markers: ['Berserk', 'Reviews'],
  },
  'character-pictures': {
    url: 'https://myanimelist.net/character/1/jikan/pics',
    markers: ['Spike Spiegel', 'Pictures'],
  },
  'person-pictures': {
    url: 'https://myanimelist.net/people/1/jikan/pics',
    markers: ['Tomokazu Seki', 'Pictures'],
  },
  'recently-online-users': {
    url: 'https://myanimelist.net/users.php',
    markers: ['Users', '/profile/'],
  },
  'user-history-canonical': {
    url: 'https://myanimelist.net/history/amayacrab/all',
    markers: ['Amayacrab', 'History'],
  },
  'season-year': {
    url: 'https://myanimelist.net/anime/season/2025/winter',
    markers: ['Winter 2025', 'Seasonal Anime'],
  },
  'club-index': {
    url: 'https://myanimelist.net/clubs.php',
    markers: ['Anime &amp; Manga Clubs', 'clubs.php?cid='],
  },
  'club-search-candidate': {
    url: 'https://myanimelist.net/clubs.php?action=search&query=cowboy',
    markers: ['Cowboy', 'clubs.php?cid='],
  },
  'manga-stats': {
    url: 'https://myanimelist.net/manga/2/jikan/stats',
    markers: ['Berserk', 'Statistics'],
  },
} as const;

type ProbeCase = keyof typeof CASES;

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function capture(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  return match?.[1] ? decodeHtml(match[1]) : null;
}

function sectionAfter(html: string, marker: string, maxLength = 4_096): string {
  const start = html.indexOf(marker);
  return start === -1 ? '' : html.slice(start, start + maxLength);
}

function textAfterMarker(html: string, marker: string, maxLength = 1_024): string | null {
  const section = sectionAfter(html, marker, maxLength);
  return capture(section, />\s*([^<]+?)\s*</i);
}

function parseProfile(html: string) {
  const startedAt = performance.now();
  const header = html.slice(0, 12_000);
  const status = sectionAfter(html, '<ul class="user-status');
  const anime = sectionAfter(html, 'Anime Stats');
  const manga = sectionAfter(html, 'Manga Stats');

  const profile = {
    username: capture(header, /<span class="di-ib po-r">\s*([^<]+?)'s Profile\s*<\/span>/i),
    avatarUrl: capture(header, /<div class="user-image mb8">\s*<img[^>]+(?:data-src|src)="([^"]+)"/i),
    lastOnline: capture(status, /Last Online<\/span><span[^>]*>(.*?)<\/span>/i),
    gender: capture(status, /Gender<\/span><span[^>]*>(.*?)<\/span>/i),
    location: capture(status, /Location<\/span><span[^>]*>(.*?)<\/span>/i),
    anime: {
      days: capture(anime, /Days:\s*<\/span>\s*([\d.]+)/i),
      meanScore: capture(anime, /Mean Score:\s*<\/span>\s*<span[^>]*>\s*([\d.]+)/i),
    },
    manga: {
      days: capture(manga, /Days:\s*<\/span>\s*([\d.]+)/i),
      meanScore: capture(manga, /Mean Score:\s*<\/span>\s*<span[^>]*>\s*([\d.]+)/i),
    },
  };

  return { profile, parseElapsedMs: performance.now() - startedAt };
}

function parseTitleAndLinks(html: string, linkPattern: RegExp) {
  const startedAt = performance.now();
  const title = capture(html.slice(0, 8_192), /<title[^>]*>([\s\S]*?)<\/title>/i);
  let matches = 0;
  for (const _ of html.matchAll(linkPattern)) matches += 1;
  return {
    pageTitle: title,
    matchedLinks: matches,
    htmlShape: {
      relativeAnimeHref: html.includes('href="/anime/'),
      absoluteAnimeHref: html.includes('href="https://myanimelist.net/anime/'),
      titleClassCount: [...html.matchAll(/class="title"/g)].length,
    },
    parseElapsedMs: performance.now() - startedAt,
  };
}

function parseCase(probeCase: ProbeCase, html: string) {
  if (probeCase === 'profile') return parseProfile(html);

  if (probeCase === 'anime-detail' || probeCase === 'manga-detail') {
    const startedAt = performance.now();
    const detail = {
      title: capture(html, /<title[^>]*>([\s\S]*?)<\/title>/i)?.replace(/\s*\([^)]*\)\s*- MyAnimeList\.net$/i, '') ?? null,
      score: textAfterMarker(html, 'itemprop="ratingValue"'),
      synopsisPresent: html.includes('itemprop="description"'),
      htmlShape: {
        itempropNameCount: [...html.matchAll(/itemprop="name"/g)].length,
        titleClassCount: [...html.matchAll(/class="title"/g)].length,
      },
    };
    return { profile: detail, parseElapsedMs: performance.now() - startedAt };
  }

  if (probeCase === 'character-detail') {
    const startedAt = performance.now();
    return {
      profile: {
        title: capture(html, /<title[^>]*>([\s\S]*?)<\/title>/i)?.replace(/\s*- MyAnimeList\.net$/i, '') ?? null,
        animeographyPresent: html.includes('Animeography'),
        voiceActorsPresent: html.includes('Voice Actors'),
      },
      parseElapsedMs: performance.now() - startedAt,
    };
  }

  if (probeCase === 'person-detail') {
    const startedAt = performance.now();
    let voiceRoleLinks = 0;
    for (const _ of html.matchAll(/href="(?:https:\/\/myanimelist\.net)?\/character\/\d+\//g)) voiceRoleLinks += 1;
    return {
      profile: {
        title: capture(html, /<title[^>]*>([\s\S]*?)<\/title>/i)?.replace(/\s*- MyAnimeList\.net$/i, '') ?? null,
        voiceActingRolesPresent: html.includes('Voice Acting Roles'),
        characterLinks: voiceRoleLinks,
      },
      parseElapsedMs: performance.now() - startedAt,
    };
  }

  if (probeCase === 'producer-detail') {
    const startedAt = performance.now();
    let animeLinks = 0;
    for (const _ of html.matchAll(/href="(?:https:\/\/myanimelist\.net)?\/anime\/\d+\//g)) animeLinks += 1;
    return {
      profile: {
        title: capture(html, /<title[^>]*>([\s\S]*?)<\/title>/i)?.replace(/\s*- MyAnimeList\.net$/i, '') ?? null,
        animeLinks,
      },
      parseElapsedMs: performance.now() - startedAt,
    };
  }

  if (probeCase === 'club-detail') {
    const startedAt = performance.now();
    let memberProfileLinks = 0;
    for (const _ of html.matchAll(/href="(?:https:\/\/myanimelist\.net)?\/profile\//g)) memberProfileLinks += 1;
    return {
      profile: {
        title: capture(html, /<title[^>]*>([\s\S]*?)<\/title>/i)?.replace(/\s*- MyAnimeList\.net$/i, '') ?? null,
        membersPresent: html.includes('Members'),
        staffPresent: html.includes('Staff'),
        memberProfileLinks,
      },
      parseElapsedMs: performance.now() - startedAt,
    };
  }

  const patterns: Record<Exclude<ProbeCase, 'profile' | 'anime-detail' | 'manga-detail' | 'character-detail' | 'person-detail' | 'producer-detail' | 'club-detail'>, RegExp> = {
    'anime-search': /href="(?:https:\/\/myanimelist\.net)?\/anime\/\d+\//g,
    'top-anime': /href="(?:https:\/\/myanimelist\.net)?\/anime\/\d+\//g,
    'season-now': /href="(?:https:\/\/myanimelist\.net)?\/anime\/\d+\//g,
    genres: /<input[^>]+name="genre\[\]"[^>]+value="\d+"/g,
    'manga-search': /href="(?:https:\/\/myanimelist\.net)?\/manga\/\d+\//g,
    'top-manga': /href="(?:https:\/\/myanimelist\.net)?\/manga\/\d+\//g,
    'character-search': /href="(?:https:\/\/myanimelist\.net)?\/character\/\d+\//g,
    'people-search': /href="(?:https:\/\/myanimelist\.net)?\/people\/\d+\//g,
    'top-characters': /href="(?:https:\/\/myanimelist\.net)?\/character\/\d+\//g,
    'top-people': /href="(?:https:\/\/myanimelist\.net)?\/people\/\d+\//g,
    'airing-collection': /href="(?:https:\/\/myanimelist\.net)?\/anime\/\d+\//g,
    'upcoming-season': /href="(?:https:\/\/myanimelist\.net)?\/anime\/\d+\//g,
    'recent-anime-reviews': /reviews\.php\?id=\d+/g,
    'recent-manga-reviews': /reviews\.php\?id=\d+/g,
    'manga-genres': /<input[^>]+name="genre\[\]"[^>]+value="\d+"/g,
    magazines: /href="(?:https:\/\/myanimelist\.net)?\/manga\/magazine\/\d+\//g,
    'anime-episodes': /\/episode\/\d+/g,
    'anime-videos': /(?:youtube\.com|youtube-nocookie\.com|youtu\.be)\/embed\/[^"?&]+/g,
    'anime-stats': /score-label/g,
    'user-animelist': /href="(?:https:\/\/myanimelist\.net)?\/anime\/\d+\//g,
    'user-mangalist': /href="(?:https:\/\/myanimelist\.net)?\/manga\/\d+\//g,
    'user-history': /href="(?:https:\/\/myanimelist\.net)?\/(?:anime|manga)\/\d+\//g,
    'user-reviews': /reviews\.php\?id=\d+/g,
    'user-friends': /href="(?:https:\/\/myanimelist\.net)?\/profile\//g,
    'top-anime-reviews-candidate': /review-element/g,
    'recent-anime-recommendations': /href="(?:https:\/\/myanimelist\.net)?\/anime\/\d+\//g,
    'recent-manga-recommendations': /href="(?:https:\/\/myanimelist\.net)?\/manga\/\d+\//g,
    'anime-detail-recommendations': /href="(?:https:\/\/myanimelist\.net)?\/anime\/\d+\//g,
    'manga-detail-recommendations': /href="(?:https:\/\/myanimelist\.net)?\/manga\/\d+\//g,
    'watch-recent-episodes': /\/episode\/\d+/g,
    'watch-popular-episodes': /\/episode\/\d+/g,
    'watch-recent-promos': /youtube-nocookie\.com\/embed\/[^"?&]+/g,
    'watch-popular-promos': /youtube-nocookie\.com\/embed\/[^"?&]+/g,
    'producer-list': /href="(?:https:\/\/myanimelist\.net)?\/anime\/producer\/\d+\//g,
    'club-members': /href="(?:https:\/\/myanimelist\.net)?\/profile\//g,
    'user-clubs': /href="(?:https:\/\/myanimelist\.net)?\/clubs\.php\?cid=\d+/g,
    'user-recommendations-empty': /recommendation/g,
    'anime-characters': /href="(?:https:\/\/myanimelist\.net)?\/character\/\d+\//g,
    'anime-forum': /topicid=\d+/g,
    'anime-moreinfo': /href=/g,
    'anime-news': /\/news\/\d+/g,
    'anime-pictures': /cdn\.myanimelist\.net\/images\//g,
    'anime-reviews': /review-element/g,
    'manga-characters': /href="(?:https:\/\/myanimelist\.net)?\/character\/\d+\//g,
    'manga-forum': /topicid=\d+/g,
    'manga-moreinfo': /href=/g,
    'manga-news': /\/news\/\d+/g,
    'manga-pictures': /cdn\.myanimelist\.net\/images\//g,
    'manga-reviews': /review-element/g,
    'character-pictures': /cdn\.myanimelist\.net\/images\//g,
    'person-pictures': /cdn\.myanimelist\.net\/images\//g,
    'recently-online-users': /href="(?:https:\/\/myanimelist\.net)?\/profile\//g,
    'user-history-canonical': /href="(?:https:\/\/myanimelist\.net)?\/(?:anime|manga)\/\d+\//g,
    'season-year': /href="(?:https:\/\/myanimelist\.net)?\/anime\/\d+\//g,
    'club-index': /href="(?:https:\/\/myanimelist\.net)?\/clubs\.php\?cid=\d+/g,
    'club-search-candidate': /href="(?:https:\/\/myanimelist\.net)?\/clubs\.php\?cid=\d+/g,
    'manga-stats': /score-label/g,
  };
  const result = parseTitleAndLinks(html, patterns[probeCase]);
  return { profile: result, parseElapsedMs: result.parseElapsedMs };
}

async function parsePersonStreaming(response: Response) {
  const startedAt = performance.now();
  let title = '';
  let voiceActingRolesPresent = false;
  let characterLinks = 0;
  let htmlBytes = 0;

  const transformed = new HTMLRewriter()
    .on('title', {
      text(chunk) {
        title += chunk.text;
      },
    })
    .on('h2.h2_overwrite', {
      text(chunk) {
        if (chunk.text.includes('Voice Acting Roles')) voiceActingRolesPresent = true;
      },
    })
    .on('a[href*="/character/"]', {
      element() {
        characterLinks += 1;
      },
    })
    .transform(response);

  const reader = transformed.body?.getReader();
  if (!reader) throw new Error('Upstream response had no body');
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    htmlBytes += value.byteLength;
  }

  return {
    profile: {
      title: decodeHtml(title).replace(/\s*- MyAnimeList\.net$/i, '') || null,
      voiceActingRolesPresent,
      characterLinks,
    },
    htmlBytes,
    parseElapsedMs: performance.now() - startedAt,
  };
}

export default {
  async fetch(request: Request): Promise<Response> {
    const requestUrl = new URL(request.url);
    if (requestUrl.pathname !== '/probe' || request.method !== 'GET') {
      return new Response('Not found', { status: 404 });
    }

    const candidate = requestUrl.searchParams.get('case') ?? 'profile';
    if (!(candidate in CASES)) return Response.json({ error: 'Unknown probe case' }, { status: 400 });
    const probeCase = candidate as ProbeCase;
    const testCase = CASES[probeCase];

    const fetchStartedAt = performance.now();
    const upstream = await fetch(testCase.url, {
      headers: {
        'User-Agent': 'jikan-edge-profile-probe/0.1',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    const fetchElapsedMs = performance.now() - fetchStartedAt;
    const html = await upstream.text();
    const parsed = parseCase(probeCase, html);
    const htmlBytes = new TextEncoder().encode(html).byteLength;
    const profile = parsed.profile;
    const parseElapsedMs = parsed.parseElapsedMs;
    const suspicious = upstream.status !== 200 || testCase.markers.some((marker) => !html.includes(marker));

    console.log(JSON.stringify({
      probe: `myanimelist-${probeCase}`,
      upstreamStatus: upstream.status,
      htmlBytes,
      fetchElapsedMs: Number(fetchElapsedMs.toFixed(2)),
      parseElapsedMs: Number(parseElapsedMs.toFixed(3)),
      suspicious,
    }));

    return Response.json(
      {
        probe: `myanimelist-${probeCase}`,
        upstream: {
          status: upstream.status,
          contentType: upstream.headers.get('content-type'),
          htmlBytes,
          suspicious,
        },
        timings: {
          fetchElapsedMs: Number(fetchElapsedMs.toFixed(2)),
          parseElapsedMs: Number(parseElapsedMs.toFixed(3)),
        },
        profile,
        note: 'parseElapsedMs measures only this Worker\'s parser; billed CPU must be confirmed in Cloudflare observability.',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  },
};
