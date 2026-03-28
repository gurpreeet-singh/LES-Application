// Lecture recordings, transcripts, sync log

export type UploadStatus = 'recording' | 'uploading' | 'uploaded' | 'verified' | 'processing' | 'completed' | 'failed';
export type RecordingSource = 'pwa' | 'web_upload' | 'mobile_app' | 'hardware_device';
export type PurgeStatus = 'retained' | 'purgeable' | 'purged';
export type TranscriptStatus = 'processing' | 'completed' | 'failed' | 'low_quality';
export type SyncEventType = 'upload_started' | 'part_uploaded' | 'part_retry' | 'assembly_confirmed' | 'checksum_match' | 'checksum_mismatch' | 'transcription_completed' | 'purge_confirmed';

export interface LectureRecording {
  id: string;
  course_id?: string;
  session_id?: string;
  user_id: string;
  s3_upload_id?: string;
  s3_key?: string;
  total_parts?: number;
  uploaded_parts?: number;
  upload_status: UploadStatus;
  local_checksum?: string;
  cloud_checksum?: string;
  checksum_verified: boolean;
  duration_sec?: number;
  file_size_bytes?: number;
  audio_codec?: string;
  quality_score?: number;
  source: RecordingSource;
  auto_mapped: boolean;
  transcript_id?: string;
  local_purge_status: PurgeStatus;
  local_purge_at?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface TranscriptSegment {
  speaker: string;
  text: string;
  start_sec: number;
  end_sec: number;
  confidence: number;
}

export interface Transcript {
  id: string;
  recording_id: string;
  full_text: string;
  segments: TranscriptSegment[];
  language_detected?: string;
  avg_confidence?: number;
  word_count?: number;
  speaker_count?: number;
  provider?: string;
  processing_ms?: number;
  status: TranscriptStatus;
  created_at: string;
}

export interface RecordingSyncLog {
  id: string;
  recording_id: string;
  event: SyncEventType;
  part_number?: number;
  metadata?: Record<string, unknown>;
  created_at: string;
}
