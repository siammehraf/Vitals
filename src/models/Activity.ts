export interface Activity {
  filePath: string;
  type: string;
  date: string;
  duration: number;
  tags?: string[];
  project?: string;
  notes?: string;
}
