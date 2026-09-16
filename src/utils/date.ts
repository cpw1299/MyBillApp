/**
 * 获取本地日期，格式：YYYY-MM-DD。
 * 不使用 toISOString()，避免 UTC 时区导致“今天”在午夜附近跨日。
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
