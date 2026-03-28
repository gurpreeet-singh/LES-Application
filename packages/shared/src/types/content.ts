// Content items, generation jobs, embeddings

export type ContentType = 'notes' | 'mindmap' | 'podcast' | 'quiz_deck' | 'flashcard_deck' | 'transcript' | 'summary';
export type ContentSource = 'faculty_upload' | 'ai_generated' | 'lecture_transcript';
export type PublishStatus = 'draft' | 'scheduled' | 'published' | 'archived';
export type GenerationTarget = 'mindmap' | 'podcast' | 'quiz_deck' | 'flashcard_deck' | 'summary' | 'embeddings';
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface ContentItem {
  id: string;
  course_id: string;
  session_id?: string;
  content_type: ContentType;
  title: string;
  source: ContentSource;
  parent_content_id?: string;
  file_url?: string;
  structured_data?: Record<string, unknown>;
  topic_tags?: string[];
  publish_status: PublishStatus;
  scheduled_publish_at?: string;
  created_by_user_id?: string;
  created_at: string;
}

export interface ContentGenerationJob {
  id: string;
  source_content_id: string;
  target_type: GenerationTarget;
  status: JobStatus;
  result_content_id?: string;
  error_message?: string;
  processing_ms?: number;
  queued_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface ContentEmbedding {
  id: string;
  content_id: string;
  course_id: string;
  chunk_index: number;
  chunk_text: string;
  embedding?: number[];
  chunk_metadata?: Record<string, unknown>;
  created_at: string;
}
