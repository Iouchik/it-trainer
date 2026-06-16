import { db, systemLogsTable } from "@workspace/db";

type LogLevel = "info" | "warn" | "error";

export async function appLog(level: LogLevel, message: string): Promise<void> {
  try {
    await db.insert(systemLogsTable).values({ level, message });
  } catch {
    // Silently fail — log write failure should not break main functionality
  }
}
