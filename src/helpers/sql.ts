// helpers/sql.ts
export function escapeSqlValue(value: any): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") {
    if (isNaN(value)) return "NULL";
    return value.toString();
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (typeof value === "string") {
    // Escape single quotes
    return `'${value.replace(/'/g, "''")}'`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}
