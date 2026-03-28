-- 019_lecture_recording.sql
-- Layer 3-4: Lecture recordings, transcripts, sync audit log.
-- Unblocks: F-02 (Recording PWA), F-08 (Transcript View)
-- Depends on: 015 (sessions)

-- ============================================================
-- 1. ENUMs
-- ============================================================

CREATE TYPE upload_status AS ENUM (
  'recording', 'uploading', 'uploaded', 'verified', 'processing', 'completed', 'failed'
);
CREATE TYPE recording_source AS ENUM ('pwa', 'web_upload', 'mobile_app', 'hardware_device');
CREATE TYPE purge_status AS ENUM ('retained', 'purgeable', 'purged');
CREATE TYPE transcript_status AS ENUM ('processing', 'completed', 'failed', 'low_quality');
CREATE TYPE sync_event AS ENUM (
  'upload_started', 'part_uploaded', 'part_retry', 'assembly_confirmed',
  'checksum_match', 'checksum_mismatch', 'transcription_completed', 'purge_confirmed'
);

-- ============================================================
-- 2. lecture_recordings
-- ============================================================

CREATE TABLE lecture_recordings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id           UUID          REFERENCES courses(id) ON DELETE SET NULL,  -- nullable until mapped
  session_id          UUID          REFERENCES sessions(id),                     -- nullable until mapped
  user_id             UUID          NOT NULL REFERENCES profiles(id),            -- faculty
  s3_upload_id        VARCHAR(100),                    -- AWS Multipart Upload ID
  s3_key              TEXT,                            -- final S3 path
  total_parts         SMALLINT,                        -- expected chunks
  uploaded_parts      SMALLINT,                        -- successful chunks
  upload_status       upload_status NOT NULL DEFAULT 'recording',
  local_checksum      VARCHAR(64),                     -- SHA-256 from PWA
  cloud_checksum      VARCHAR(64),                     -- SHA-256 from Lambda
  checksum_verified   BOOLEAN       NOT NULL DEFAULT false,
  duration_sec        INT,
  file_size_bytes     BIGINT,
  audio_codec         VARCHAR(20),                     -- 'aac-128k'
  quality_score       DECIMAL(3,2),                    -- 0.00-1.00
  source              recording_source NOT NULL DEFAULT 'pwa',
  auto_mapped         BOOLEAN       NOT NULL DEFAULT false,
  transcript_id       UUID,                            -- FK added after transcripts table
  local_purge_status  purge_status  NOT NULL DEFAULT 'retained',
  local_purge_at      TIMESTAMPTZ,
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_recordings_course ON lecture_recordings (course_id) WHERE course_id IS NOT NULL;
CREATE INDEX idx_recordings_session ON lecture_recordings (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_recordings_faculty ON lecture_recordings (user_id);
CREATE INDEX idx_recordings_status ON lecture_recordings (upload_status)
  WHERE upload_status NOT IN ('completed', 'failed');

-- ============================================================
-- 3. transcripts
-- ============================================================

CREATE TABLE transcripts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id      UUID          NOT NULL REFERENCES lecture_recordings(id) ON DELETE CASCADE,
  full_text         TEXT          NOT NULL,
  segments          JSONB         NOT NULL DEFAULT '[]',
    -- [{speaker, text, start_sec, end_sec, confidence}]
  language_detected VARCHAR(10),                       -- 'hi', 'en', 'hi-en'
  avg_confidence    DECIMAL(3,2),                      -- 0.00-1.00
  word_count        INT,
  speaker_count     SMALLINT,
  provider          VARCHAR(30),                       -- 'deepgram_nova2', 'google_stt_v2'
  processing_ms     INT,
  status            transcript_status NOT NULL DEFAULT 'processing',
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_transcripts_recording ON transcripts (recording_id);
CREATE INDEX idx_transcripts_status ON transcripts (status) WHERE status = 'processing';

-- Add FK from lecture_recordings to transcripts now that table exists
ALTER TABLE lecture_recordings
  ADD CONSTRAINT fk_recordings_transcript
  FOREIGN KEY (transcript_id) REFERENCES transcripts(id);

-- ============================================================
-- 4. recording_sync_log — append-only audit log
-- ============================================================

CREATE TABLE recording_sync_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id    UUID          NOT NULL REFERENCES lecture_recordings(id) ON DELETE CASCADE,
  event           sync_event    NOT NULL,
  part_number     SMALLINT,                            -- for part upload events
  metadata        JSONB         DEFAULT '{}',          -- {bytes, retry_count, error, duration_ms}
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_sync_log_recording ON recording_sync_log (recording_id);
CREATE INDEX idx_sync_log_event ON recording_sync_log (recording_id, event);

-- ============================================================
-- 5. RLS policies
-- ============================================================

ALTER TABLE lecture_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE recording_sync_log ENABLE ROW LEVEL SECURITY;

-- Recordings: faculty manages own, course participants view
CREATE POLICY "Faculty manages own recordings"
  ON lecture_recordings FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Course participants view recordings"
  ON lecture_recordings FOR SELECT TO authenticated
  USING (
    course_id IN (
      SELECT course_id FROM enrollments WHERE student_id = auth.uid()
    )
  );

CREATE POLICY "Admins view all recordings"
  ON lecture_recordings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Transcripts: same as recordings
CREATE POLICY "Faculty and students view transcripts"
  ON transcripts FOR SELECT TO authenticated
  USING (
    recording_id IN (
      SELECT id FROM lecture_recordings WHERE user_id = auth.uid()
      UNION
      SELECT lr.id FROM lecture_recordings lr
      JOIN enrollments e ON lr.course_id = e.course_id
      WHERE e.student_id = auth.uid()
    )
  );

CREATE POLICY "Service role manages transcripts"
  ON transcripts FOR ALL TO service_role USING (true);

-- Sync log: service role writes, faculty reads own
CREATE POLICY "Faculty views own sync logs"
  ON recording_sync_log FOR SELECT TO authenticated
  USING (recording_id IN (SELECT id FROM lecture_recordings WHERE user_id = auth.uid()));

CREATE POLICY "Service role manages sync logs"
  ON recording_sync_log FOR ALL TO service_role USING (true);
