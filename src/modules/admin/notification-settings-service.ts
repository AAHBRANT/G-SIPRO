import { randomUUID } from "node:crypto";

import { z } from "zod";

import { getDatabase } from "@/core/database/prisma";

export const notificationSettingsPatchSchema = z.object({
  emailSender: z.email().nullable(),
});

export type NotificationSettingsView = Readonly<{
  emailSender: string | null;
  version: number;
  updatedAt: string;
}>;

export type NotificationSenderSettingsReader = Readonly<{
  getEmailSender(): Promise<string | null>;
}>;

async function currentRow() {
  return getDatabase().notificationSettings.findFirst({ orderBy: { updatedAt: "desc" } });
}

export class NotificationSettingsService {
  async get(): Promise<NotificationSettingsView | null> {
    const settings = await currentRow();
    if (!settings) return null;
    return { emailSender: settings.emailSender, version: settings.version, updatedAt: settings.updatedAt.toISOString() };
  }

  async setEmailSender(emailSender: string | null, actorId: string): Promise<NotificationSettingsView> {
    const database = getDatabase();
    const existing = await currentRow();
    const saved = existing
      ? await database.notificationSettings.update({
          where: { id: existing.id },
          data: { emailSender, version: existing.version + 1, updatedBy: actorId },
        })
      : await database.notificationSettings.create({
          data: { id: randomUUID(), emailSender, updatedBy: actorId },
        });
    return { emailSender: saved.emailSender, version: saved.version, updatedAt: saved.updatedAt.toISOString() };
  }
}

export const prismaNotificationSenderSettingsReader: NotificationSenderSettingsReader = {
  async getEmailSender() {
    const settings = await currentRow();
    return settings?.emailSender ?? null;
  },
};
