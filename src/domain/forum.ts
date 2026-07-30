export interface ForumThread {
  topicId: number;
  title: string;
  startedBy: string | null;
  startedDate: string | null;
  replies: number | null;
  lastPostBy: string | null;
}

export const FORUM_PARSER_VERSION = 'forum-html-v2';
