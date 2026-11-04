export interface Activity {
  id: string;
  title: string;
  type: string;
  date: string; // ISO format: YYYY-MM-DD
  duration: number; // Normalized integer minutes
  project?: string;
}
