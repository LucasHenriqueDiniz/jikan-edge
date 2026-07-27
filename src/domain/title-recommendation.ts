export interface TitleRecommendation {
  malId: number;
  title: string;
  imageUrl: string | null;
  votes: number;
}

export const TITLE_RECOMMENDATIONS_PARSER_VERSION = 'title-recommendations-html-v1';
