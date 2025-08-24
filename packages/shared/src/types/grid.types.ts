export interface GridCell {
  row: number;
  col: number;
  value: string | number | boolean | null;
  format?: string;
}

export interface GridSnapshot {
  id: string;
  rows: number;
  cols: number;
  cells: Record<string, GridCell>; // key: `${row}:${col}`
}

