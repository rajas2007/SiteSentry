export interface WarningData {
  warningId: string;
  targetUrl: string;
  hostname: string;
  score: number;
  severity: 'low' | 'medium' | 'high';
  threatCategory: string;
  factors: string[];
  recommendations: string[];
  timestamp: number;
}
