export interface ThemeSong {
  title: string;
  artist: string | null;
  episodes: string | null;
}

export interface AnimeThemeSongs {
  openings: ThemeSong[];
  endings: ThemeSong[];
}
