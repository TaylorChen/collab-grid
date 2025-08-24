export function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

export function nowTs(): number {
  return Date.now();
}

