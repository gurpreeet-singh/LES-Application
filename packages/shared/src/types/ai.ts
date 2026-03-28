// AI Tutor, voice feedback, job queue

export type CallStatus = 'scheduled' | 'in_progress' | 'completed' | 'no_answer' | 'declined' | 'failed';
export type AIJobType = 'content_generation' | 'embedding' | 'transcription' | 'risk_scoring' | 'feedback_analysis' | 'report_generation' | 'absentee_call';
export type AIJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'retry';

export interface TutorMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  tokens_used?: number;
  sources?: { content_id: string; title: string; chunk_text: string }[];
}

export interface TutorConversation {
  id: string;
  user_id: string;
  course_id: string;
  messages: TutorMessage[];
  message_count: number;
  topics_discussed?: string[];
  comprehension_scores?: Record<string, number>;
  last_active_at?: string;
  created_at: string;
}

export interface SentimentScores {
  overall: number;
  scores: {
    quality: number;
    pace: number;
    content: number;
    faculty: number;
  };
}

export interface VoiceFeedback {
  id: string;
  user_id: string;
  course_id: string;
  call_sid?: string;
  call_status: CallStatus;
  transcript?: string;
  duration_sec?: number;
  sentiment?: SentimentScores;
  themes?: string[];
  raw_feedback?: { question: string; answer: string }[];
  week_number?: number;
  called_at?: string;
  created_at: string;
}

export interface AIJob {
  id: string;
  job_type: AIJobType;
  payload: Record<string, unknown>;
  priority: number;
  status: AIJobStatus;
  attempts: number;
  max_attempts: number;
  error_message?: string;
  result?: Record<string, unknown>;
  locked_by?: string;
  locked_at?: string;
  scheduled_for: string;
  completed_at?: string;
  created_at: string;
}
