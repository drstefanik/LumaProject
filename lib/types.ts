export interface LumaScores {
  fluency: number;
  pronunciation: number;
  grammar: number;
  vocabulary: number;
  coherence: number;
}

export interface LumaSpeakingReport {
  type: "luma_speaking_report";
  accent_label: string;
  accent_detail: string;
  language_pair: string;
  cefr_global: string;
  scores: LumaScores;
  strengths: string;
  weaknesses: string;
  recommendations: string;
  transcript_summary: string;
  meta?: {
    candidateId?: string;
    candidateName?: string;
    sessionId?: string;
  };
}
