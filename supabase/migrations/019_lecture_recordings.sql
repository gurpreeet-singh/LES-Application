-- Migration 019: Lecture Recording
-- Audio recordings, AI-generated transcripts, upload audit log

CREATE TYPE upload_status AS ENUM ('recording', 'uploading', 'uploaded', 'verified', 'processing', 'completed', 'failed');
CREATE TYPE transcript_status AS ENUM ('processing', 'completed', 'failed', 'low_quality');
CREATE TYPE recording_source AS ENUM ('pwa', 'web_upload', 'mobile_app', 'hardware_device');
CREATE TYPE purge_status AS ENUM ('retained', 'purgeable', 'purged');
CREATE TYPE sync_event AS ENUM ('upload_started', 'part_uploaded', 'part_retry', 'assembly_confirmed', 'checksum_match', 'checksum_mismatch', 'transcription_completed', 'purge_confirmed');

-- Audio recordings with upload lifecycle tracking
CREATE TABLE public.lecture_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id),
  s3_upload_id VARCHAR(100),
  s3_key TEXT,
  total_parts SMALLINT,
  uploaded_parts SMALLINT,
  upload_status upload_status NOT NULL DEFAULT 'recording',
  local_checksum VARCHAR(64),
  cloud_checksum VARCHAR(64),
  checksum_verified BOOLEAN NOT NULL DEFAULT false,
  duration_sec INT,
  file_size_bytes BIGINT,
  audio_codec VARCHAR(20),
  quality_score DECIMAL(3,2),
  source recording_source NOT NULL DEFAULT 'pwa',
  auto_mapped BOOLEAN NOT NULL DEFAULT false,
  transcript_id UUID,
  local_purge_status purge_status NOT NULL DEFAULT 'retained',
  local_purge_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI-generated transcripts from recordings
CREATE TABLE public.transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID NOT NULL REFERENCES public.lecture_recordings(id) ON DELETE CASCADE,
  full_text TEXT NOT NULL,
  segments JSONB NOT NULL DEFAULT '[]',
  language_detected VARCHAR(10),
  avg_confidence DECIMAL(3,2),
  word_count INT,
  speaker_count SMALLINT,
  provider VARCHAR(30),
  processing_ms INT,
  status transcript_status NOT NULL DEFAULT 'processing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add FK from lecture_recordings to transcripts (circular reference)
ALTER TABLE public.lecture_recordings
  ADD CONSTRAINT fk_lecture_recordings_transcript
  FOREIGN KEY (transcript_id) REFERENCES public.transcripts(id) ON DELETE SET NULL;

-- Append-only audit log for recording upload events
CREATE TABLE public.recording_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID NOT NULL REFERENCES public.lecture_recordings(id) ON DELETE CASCADE,
  event sync_event NOT NULL,
  part_number SMALLINT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_lecture_recordings_course ON public.lecture_recordings(course_id);
CREATE INDEX idx_lecture_recordings_session ON public.lecture_recordings(session_id);
CREATE INDEX idx_lecture_recordings_teacher ON public.lecture_recordings(teacher_id);
CREATE INDEX idx_lecture_recordings_status ON public.lecture_recordings(upload_status);
CREATE INDEX idx_lecture_recordings_source ON public.lecture_recordings(source);
CREATE INDEX idx_transcripts_recording ON public.transcripts(recording_id);
CREATE INDEX idx_transcripts_status ON public.transcripts(status);
CREATE INDEX idx_recording_sync_log_recording ON public.recording_sync_log(recording_id);
CREATE INDEX idx_recording_sync_log_event ON public.recording_sync_log(event);

-- RLS
ALTER TABLE public.lecture_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_sync_log ENABLE ROW LEVEL SECURITY;

-- Recordings: teachers manage own, students view completed for enrolled courses
CREATE POLICY "Teachers manage own recordings" ON public.lecture_recordings
  FOR ALL USING (teacher_id = auth.uid());

CREATE POLICY "Students view completed recordings for enrolled courses" ON public.lecture_recordings
  FOR SELECT USING (
    upload_status = 'completed' AND
    EXISTS (SELECT 1 FROM public.enrollments WHERE course_id = lecture_recordings.course_id AND student_id = auth.uid())
  );

CREATE POLICY "Admins view all recordings" ON public.lecture_recordings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'management'))
  );

-- Transcripts: follow recording access
CREATE POLICY "Teachers view transcripts for own recordings" ON public.transcripts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.lecture_recordings WHERE id = transcripts.recording_id AND teacher_id = auth.uid())
  );

CREATE POLICY "Students view transcripts for enrolled courses" ON public.transcripts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lecture_recordings lr
      JOIN public.enrollments e ON e.course_id = lr.course_id
      WHERE lr.id = transcripts.recording_id AND e.student_id = auth.uid() AND lr.upload_status = 'completed'
    )
  );

CREATE POLICY "Admins view all transcripts" ON public.transcripts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'management'))
  );

-- Sync log: teachers view for own recordings, admins view all
CREATE POLICY "Teachers view sync log for own recordings" ON public.recording_sync_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.lecture_recordings WHERE id = recording_sync_log.recording_id AND teacher_id = auth.uid())
  );

CREATE POLICY "Admins view all sync logs" ON public.recording_sync_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'management'))
  );
