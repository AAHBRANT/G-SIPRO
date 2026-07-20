import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { readDocumentFile } from "@/core/storage/document-storage";
import { toApiError } from "@/core/errors/api-error";

export async function GET(_: Request, route: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("technical-archive.read");
    const id = z.uuid().parse((await route.params).id);
    const version = await getDatabase().managedDocumentVersion.findUnique({ where: { id }, include: { document: true } });
    if (!version || version.document.type !== "ATESTADO") return NextResponse.json({ error: { message: "Acervo não encontrado." } }, { status: 404 });
    const bytes = await readDocumentFile(version.fileHash);
    const safeTitle = version.document.title.replace(/[^a-zA-Z0-9._-]+/g, "_");
    return new Response(new Uint8Array(bytes), { headers: { "content-type": version.mimeType, "content-disposition": `inline; filename="${safeTitle}"`, "cache-control": "private, no-store", "x-content-sha256": version.fileHash } });
  } catch (error) { return toApiError(error); }
}
