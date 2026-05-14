export interface FishVoice {
  id: string;
  title: string;
  authorId: string;
  authorNickname: string;
  languages: string[];
  tags: string[];
  description: string;
  visibility: string;
  taskCount: number;
}

export interface FishVoiceSearchResult {
  total: number;
  items: FishVoice[];
  hasMore: boolean | null;
}
