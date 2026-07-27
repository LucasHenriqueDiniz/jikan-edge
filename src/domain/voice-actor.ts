export interface VoiceActor {
  malId: number;
  name: string;
  imageUrl: string | null;
  language: string | null;
}

export const VOICE_ACTOR_PARSER_VERSION = 'voice-actor-html-v1';
