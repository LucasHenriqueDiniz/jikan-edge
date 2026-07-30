export interface RecommendationEntry {
  malId: number;
  title: string;
  imageUrl: string | null;
  recommendedMalId: number;
  recommendedTitle: string;
  recommendedImageUrl: string | null;
  content: string | null;
  username: string | null;
}

export const RECOMMENDATION_PARSER_VERSION = 'recommendation-html-v2';
