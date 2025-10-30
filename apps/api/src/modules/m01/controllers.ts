import type { Request, Response } from "express";
import mongoose from "mongoose";
import UploadFile from "./models/UploadFile.js";
import { Readable } from "stream";
import { parse } from "csv-parse";

// POST /m01/uploads - multer should place file on req.file (memory storage)
export async function uploadFile(req: Request, res: Response) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const file: any = (req as any).file;
    const body: any = (req as any).body || {};
    if (!file) return res.status(400).json({ error: "file is required" });
    const workspaceId = body.workspace;
    if (!workspaceId || !mongoose.isValidObjectId(workspaceId)) return res.status(400).json({ error: "workspace is required" });

    const db = mongoose.connection.db;
    if (!db) return res.status(500).json({ error: "db not ready" });
    const bucket = new mongoose.mongo.GridFSBucket(db as any, { bucketName: "m01_uploads" });

    const uploadStream = bucket.openUploadStream(file.originalname, {
      contentType: file.mimetype,
      metadata: { originalName: file.originalname, uploadedBy: (req as any).user?.id ?? null, workspace: workspaceId },
    });

    const readable = Readable.from(file.buffer);
    readable.pipe(uploadStream)
      .on("error", (err) => {
        console.error("GridFS upload error:", err);
        return res.status(500).json({ error: "upload failed" });
      })
      .on("finish", async () => {
        const created = await UploadFile.create({
          fileId: uploadStream.id,
          filename: uploadStream.filename,
          originalName: file.originalname,
          contentType: file.mimetype,
          length: uploadStream.length ?? file.size,
          metadata: uploadStream.options?.metadata ?? {},
          workspace: workspaceId,
          uploadedBy: (req as any).user?.id ?? null,
        });
        return res.json({ ok: true, id: created._id, fileId: uploadStream.id });
      });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "internal" });
  }
}

// GET /m01/uploads - list uploaded files
export async function listUploads(req: Request, res: Response) {
  try {
    const workspace = (req.query.workspace as string) || null;
    const filter: any = {};
    if (workspace) {
      if (!mongoose.isValidObjectId(workspace)) return res.status(400).json({ error: 'invalid workspace id' });
      filter.workspace = workspace;
    }
    const items = await UploadFile.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ ok: true, items });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "internal" });
  }
}

// GET /m01/uploads/:id/preview?rows=5 - return first N rows of CSV
export async function previewUpload(req: Request, res: Response) {
  try {
  const id = req.params.id;
  const rows = parseInt((req.query.rows as string) || "5", 10);
  const workspace = (req.query.workspace as string) || null;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "invalid id" });

  const doc = await UploadFile.findById(id).lean();
  if (!doc) return res.status(404).json({ error: "not found" });
  if (workspace && String(doc.workspace) !== String(workspace)) return res.status(403).json({ error: 'forbidden' });

  const db = mongoose.connection.db;
  if (!db) return res.status(500).json({ error: "db not ready" });
  const bucket = new mongoose.mongo.GridFSBucket(db as any, { bucketName: "m01_uploads" });
    const downloadStream = bucket.openDownloadStream(doc.fileId);

    const rowsOut: string[][] = [];
    // We'll buffer the file into memory for a small preview — acceptable for quick previews
    const chunks: Buffer[] = [];
    downloadStream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    downloadStream.on("error", (err) => {
      console.error("download error", err);
      res.status(500).json({ error: "download error" });
    });
    downloadStream.on("end", () => {
      try {
        const buf = Buffer.concat(chunks);
        parse(buf, { bom: true }, (err, output: string[][]) => {
          if (err) {
            console.error("csv parse error", err);
            return res.status(500).json({ error: "parse error" });
          }
          // return header + first N rows (if present)
          const slice = output.slice(0, rows + 1);
          return res.json({ ok: true, rows: slice });
        });
      } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "internal" });
      }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "internal" });
  }
}
