export interface StreamInfo {
  viewerCount: number;
  startedAt: string;
  thumbnailUrl: string;
}

export interface StreamStatus {
  live: boolean;
  stream: StreamInfo | null;
}