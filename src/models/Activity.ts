export interface Activity {
  id: string;
  title: string;
  type: string;
  date: string;
  duration: number; // in minutes
  project?: string;
  hour?: number; // 0 to 23 (for Time-of-Day distribution)
}
