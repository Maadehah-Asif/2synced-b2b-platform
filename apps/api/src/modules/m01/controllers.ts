import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Readable } from 'stream';
// csv-parse: streaming parser for large files and sync parser for small prefix parsing
// Use ESM imports to avoid runtime "require is not defined" errors under Node ESM
import { parse } from 'csv-parse';
// import the synchronous parser; include .js to satisfy node16/module resolution
// use the streaming parser's callback API for parsing the prefix string
// (avoid importing internal package subpaths that may not be exported)

import UploadFile from './models/UploadFile.js';
import TARGET_SCHEMA, { TARGET_SCHEMA_VERSION } from './targetSchema.js';
import MergeAudit from './models/MergeAudit.js';
import MergedFile from './models/MergedFile.js';
import LeadsCodeFile from './models/LeadsCodeFile.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import fs from 'fs';

// __dirname is not available in ESM; synthesize it from import.meta.url
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Enable verbose preview logging if M01_PREVIEW_LOG=1 in environment
const PREVIEW_LOG = process.env.M01_PREVIEW_LOG === '1';

// POST /m01/uploads - multer should place file on req.file (memory storage)
export async function uploadFile(req: Request, res: Response) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const file: any = (req as any).file;
    const body: any = (req as any).body || {};
    if (!file) return res.status(400).json({ error: 'file is required' });
    const workspaceId = body.workspace;
    if (!workspaceId || !mongoose.isValidObjectId(workspaceId)) return res.status(400).json({ error: 'workspace is required' });
    const db = mongoose.connection.db;
    if (!db) return res.status(500).json({ error: 'db not ready' });
    const bucket = new mongoose.mongo.GridFSBucket(db as any, { bucketName: 'm01_uploads' });
    const user = (req as any).user || null;
    const uploaderId = user ? (user._id ?? user.id ?? null) : null;
    const uploadStream = bucket.openUploadStream(file.originalname, {
      contentType: file.mimetype,
      metadata: { originalName: file.originalname, uploadedBy: uploaderId, workspace: workspaceId },
    });
    const readable = Readable.from(file.buffer);
    readable.pipe(uploadStream)
      .on('error', (err) => {
        console.error('GridFS upload error:', err);
        return res.status(500).json({ error: 'upload failed' });
      })
      .on('finish', async () => {
        const uploaderSnapshot = user ? {
          id: String(uploaderId ?? ''),
          email: user.email ?? null,
          fullName: user.fullName ?? user.name ?? null,
          username: user.username ?? null,
        } : null;
        const created = await UploadFile.create({
          fileId: uploadStream.id,
          filename: uploadStream.filename,
          originalName: file.originalname,
          contentType: file.mimetype,
          length: uploadStream.length ?? file.size,
          metadata: Object.assign({}, uploadStream.options?.metadata ?? {}, { uploader: uploaderSnapshot }),
          workspace: workspaceId,
          uploadedBy: uploaderId ?? null,
        });
        return res.json({ ok: true, id: created._id, fileId: uploadStream.id });
      });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'internal' });
  }
}

// GET /m01/uploads - list uploaded files
export async function listUploads(req: Request, res: Response) {
  try {
    const workspace = (req.query.workspace as string) || null;
    const status = (req.query.status as string) || 'active';
    const filter: any = {};
    if (workspace) {
      if (!mongoose.isValidObjectId(workspace)) return res.status(400).json({ error: 'invalid workspace id' });
      filter.workspace = workspace;
    }
    if (status && status !== 'all') filter.status = status;
    const items = await UploadFile.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ ok: true, items });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'internal' });
  }
}

// GET /m01/uploads/:id/preview?perPage=20&page=1 - return detected header, sample rows and inferred column types
export async function previewUpload(req: Request, res: Response) {
  try {
    const id = String(req.params.id || '');
    const perPage = parseInt(String(req.query.perPage || '20'), 10) || 20;
    const page = parseInt(String(req.query.page || '1'), 10) || 1;
    const workspace = (req.query.workspace as string) || null;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid id' });
    const doc = await UploadFile.findById(id).lean();
    if (!doc) return res.status(404).json({ error: 'not found' });
    if (workspace && String(doc.workspace) !== String(workspace)) return res.status(403).json({ error: 'forbidden' });
    const db = mongoose.connection.db;
    if (!db) return res.status(500).json({ error: 'db not ready' });
    const bucket = new mongoose.mongo.GridFSBucket(db as any, { bucketName: 'm01_uploads' });

    const downloadStream = bucket.openDownloadStream(doc.fileId);
    if (PREVIEW_LOG) console.info(`[m01.preview] opening download stream for fileId=${String(doc.fileId)} (_id=${id})`);

    // safety timeout
    const PREVIEW_TIMEOUT_MS = 30000;
    let previewTimeout: NodeJS.Timeout | null = setTimeout(() => {
      try {
        if (PREVIEW_LOG) console.warn(`[m01.preview] timeout after ${PREVIEW_TIMEOUT_MS}ms for fileId=${String(doc.fileId)} (_id=${id})`);
        try { downloadStream.destroy(); } catch (_) {}
        if (!res.headersSent) return res.status(504).json({ error: 'preview timeout' });
      } catch (e) { /* ignore */ }
    }, PREVIEW_TIMEOUT_MS);

    // prefer a record-count based streaming parse for robustness on large files
    const RECORD_LIMIT = 500; // number of CSV records to scan for header/type inference
    let handled = false;

    const finishWithError = (code = 500, msg = 'parse error') => {
      if (previewTimeout) { clearTimeout(previewTimeout); previewTimeout = null; }
      if (!res.headersSent) return res.status(code).json({ error: msg });
    };

    const processRecords = (bufferRecords: string[][]) => {
      if (handled) return;
      handled = true;
      if (previewTimeout) { clearTimeout(previewTimeout); previewTimeout = null; }
      try {
        const rowsOut: string[][] = [];
        const scanLimit = 20;

        const looksLikeHeader = (rec: string[]) => {
          if (!rec || rec.length === 0) return false;
          let numericCount = 0; let alphaCount = 0; let nonEmpty = 0;
          for (const cell of rec) {
            if (cell !== null && typeof cell !== 'undefined' && String(cell).trim() !== '') {
              nonEmpty += 1;
              const s = String(cell).trim();
              if (/^[0-9\-\. ,]+$/.test(s)) numericCount += 1;
              if (/[A-Za-z]/.test(s)) alphaCount += 1;
            }
          }
          if (nonEmpty === 0) return false;
          return (alphaCount > 0 && numericCount / nonEmpty < 0.9);
        };

        let headerIndex = -1;
        const headerScanLimit = Math.min(bufferRecords.length, 3);
        for (let i = 0; i < headerScanLimit; i++) {
          if (looksLikeHeader(bufferRecords[i] ?? [])) { headerIndex = i; break; }
        }
        if (headerIndex === -1) {
          const maxScan = Math.min(bufferRecords.length, scanLimit);
          for (let i = 0; i < maxScan; i++) {
            if (looksLikeHeader(bufferRecords[i] ?? [])) { headerIndex = i; break; }
          }
        }
        if (headerIndex === -1 && bufferRecords.length > 0) headerIndex = 0;

        const header = bufferRecords[headerIndex] ?? [];
        const dataRecords: string[][] = [];
        for (let i = headerIndex + 1; i < bufferRecords.length; i++) dataRecords.push(bufferRecords[i] ?? []);

        const inferTypes = (rows: string[][], cols: number) => {
          const types: string[] = Array.from({ length: cols }, () => 'text');
          const scan = Math.min(rows.length, 5);
          for (let c = 0; c < cols; c++) {
            let isInt = true; let isNumeric = true; let isBool = true; let isDate = true;
            let seenNonEmpty = false;
            for (let r = 0; r < scan; r++) {
              const cell = String(((rows[r] ?? [])[c]) || '').trim();
              if (cell === '') continue;
              seenNonEmpty = true;
              if (!/^[-+]?\d+$/.test(cell)) isInt = false;
              if (!/^[-+]?\d*[\.,]?\d+$/.test(cell)) isNumeric = false;
              if (!/^(1|0|true|false|yes|no)$/i.test(cell)) isBool = false;
              const d = new Date(cell);
              if (isNaN(d.getTime())) {
                const parts = cell.split(/[\/\- ]/).map(p => p.trim());
                if (!(parts.length >= 3 && parts.every(p => /^\d+$/.test(p)))) isDate = false;
              }
            }
            if (!seenNonEmpty) { types[c] = 'text'; continue; }
            if (isInt) types[c] = 'integer';
            else if (isBool) types[c] = 'boolean';
            else if (isNumeric) types[c] = 'numeric';
            else if (isDate) types[c] = 'timestamptz';
            else types[c] = 'text';
          }
          return types;
        };

        const columnTypes = inferTypes(dataRecords, (header || []).length);
        const start = (page - 1) * perPage;
        const end = start + perPage;
        for (let i = start; i < end && i < dataRecords.length; i++) rowsOut.push(dataRecords[i] ?? []);
        const headerPromoted = headerIndex > 0;
        const hasMore = dataRecords.length > end;
        if (PREVIEW_LOG) console.info(`[m01.preview] fileId=${String(doc.fileId)} headerIndex=${headerIndex} headerPromoted=${headerPromoted} bufferRecords=${bufferRecords.length} columnTypes=${columnTypes.join(',')}`);
          if (!res.headersSent) return res.json({ ok: true, header, rows: rowsOut, page, perPage, hasMore, headerPromoted, headerIndex });
      } catch (e) {
        console.error('[m01.preview] failed to send response after parsing', e);
        return finishWithError(500, 'preview failed');
      }
    };

    // Stream parse: pipe GridFS download into csv-parse streaming parser and collect up to RECORD_LIMIT records
    const parser = parse({ bom: true });
    const bufferRecords: string[][] = [];
    parser.on('readable', () => {
      let rec: string[] | null;
      while ((rec = parser.read()) !== null) {
        bufferRecords.push(rec);
        if (bufferRecords.length >= RECORD_LIMIT) {
          try { downloadStream.destroy(); } catch (_) {}
          try { parser.destroy(); } catch (_) {}
          processRecords(bufferRecords);
          return;
        }
      }
    });
    parser.on('end', () => {
      if (!handled) processRecords(bufferRecords);
    });
    parser.on('error', (err: any) => {
      console.error('[m01.preview] parser error', err);
      if (!handled) handled = true;
      if (previewTimeout) { clearTimeout(previewTimeout); previewTimeout = null; }
      if (!res.headersSent) return res.status(500).json({ error: 'parser error' });
    });

    downloadStream.on('error', (err: any) => {
      console.error('download error', err);
      if (!handled) handled = true;
      if (previewTimeout) { clearTimeout(previewTimeout); previewTimeout = null; }
      if (!res.headersSent) return res.status(500).json({ error: 'download error' });
    });

    // kick off
    downloadStream.pipe(parser);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'internal' });
  }
}

// GET /m01/merges/:id/preview - preview a saved merged CSV from GridFS (bucket m01_merged)
export async function previewMerged(req: Request, res: Response) {
  try {
    const id = String(req.params.id || '');
    const perPage = parseInt(String(req.query.perPage || '20'), 10) || 20;
    const page = parseInt(String(req.query.page || '1'), 10) || 1;
    const workspace = (req.query.workspace as string) || null;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid id' });
  const doc = await MergedFile.findById(id).lean();
    if (!doc) return res.status(404).json({ error: 'not found' });
    if (workspace && String(doc.workspace) !== String(workspace)) return res.status(403).json({ error: 'forbidden' });
    const db = mongoose.connection.db;
    if (!db) return res.status(500).json({ error: 'db not ready' });
    const bucket = new mongoose.mongo.GridFSBucket(db as any, { bucketName: 'm01_merged' });

    const downloadStream = bucket.openDownloadStream(doc.fileId);
    const PREVIEW_TIMEOUT_MS = 30000;
    let previewTimeout: NodeJS.Timeout | null = setTimeout(() => {
      try { downloadStream.destroy(); } catch (_) {}
      if (!res.headersSent) return res.status(504).json({ error: 'preview timeout' });
    }, PREVIEW_TIMEOUT_MS);

    const RECORD_LIMIT = 500;
    let handled = false;
    const finishWithError = (code = 500, msg = 'parse error') => {
      if (previewTimeout) { clearTimeout(previewTimeout); previewTimeout = null; }
      if (!res.headersSent) return res.status(code).json({ error: msg });
    };
    const processRecords = (bufferRecords: string[][]) => {
      if (handled) return; handled = true;
      if (previewTimeout) { clearTimeout(previewTimeout); previewTimeout = null; }
      try {
        const looksLikeHeader = (rec: string[]) => {
          if (!rec || rec.length === 0) return false;
          let numericCount = 0; let alphaCount = 0; let nonEmpty = 0;
          for (const cell of rec) {
            if (cell !== null && typeof cell !== 'undefined' && String(cell).trim() !== '') {
              nonEmpty += 1;
              const s = String(cell).trim();
              if (/^[0-9\-\. ,]+$/.test(s)) numericCount += 1;
              if (/[A-Za-z]/.test(s)) alphaCount += 1;
            }
          }
          if (nonEmpty === 0) return false;
          return (alphaCount > 0 && numericCount / nonEmpty < 0.9);
        };
        let headerIndex = -1;
        const headerScanLimit = Math.min(bufferRecords.length, 3);
        for (let i = 0; i < headerScanLimit; i++) {
          if (looksLikeHeader(bufferRecords[i] ?? [])) { headerIndex = i; break; }
        }
        if (headerIndex === -1 && bufferRecords.length > 0) headerIndex = 0;
        const header = bufferRecords[headerIndex] ?? [];
        const dataRecords: string[][] = [];
        for (let i = headerIndex + 1; i < bufferRecords.length; i++) dataRecords.push(bufferRecords[i] ?? []);
        const start = (page - 1) * perPage;
        const end = start + perPage;
        const rowsOut: string[][] = [];
        for (let i = start; i < end && i < dataRecords.length; i++) rowsOut.push(dataRecords[i] ?? []);
        const headerPromoted = headerIndex > 0;
        const hasMore = dataRecords.length > end;
        if (!res.headersSent) return res.json({ ok: true, header, rows: rowsOut, page, perPage, hasMore, headerPromoted, headerIndex });
      } catch (e) { return finishWithError(500, 'preview failed'); }
    };
    const parser = parse({ bom: true });
    const bufferRecords: string[][] = [];
    parser.on('readable', () => {
      let rec: string[] | null;
      while ((rec = parser.read()) !== null) {
        bufferRecords.push(rec);
        if (bufferRecords.length >= RECORD_LIMIT) {
          try { downloadStream.destroy(); } catch (_) {}
          try { parser.destroy(); } catch (_) {}
          processRecords(bufferRecords);
          return;
        }
      }
    });
    parser.on('end', () => { if (!handled) processRecords(bufferRecords); });
    parser.on('error', () => { if (!handled) return finishWithError(500, 'parser error'); });
    downloadStream.on('error', () => { if (!handled) return finishWithError(500, 'download error'); });
    downloadStream.pipe(parser);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'internal' });
  }
}

// GET /m01/merges - list merged files with filtering/sorting
export async function listMergedFiles(req: Request, res: Response) {
  try {
    const workspace = (req.query.workspace as string) || null;
    const q = (req.query.q as string) || '';
    const sort = (req.query.sort as string) || 'createdAt_desc';
    const dbSort: any = {};
    if (sort === 'createdAt_asc') dbSort.createdAt = 1;
    else if (sort === 'name_asc') dbSort.name = 1;
    else if (sort === 'name_desc') dbSort.name = -1;
    else dbSort.createdAt = -1;
    if (workspace && !mongoose.isValidObjectId(workspace)) return res.status(400).json({ error: 'invalid workspace id' });
    const filter: any = workspace ? { workspace } : {};
    if (q && q.trim()) filter.$or = [{ name: { $regex: q, $options: 'i' } }, { filename: { $regex: q, $options: 'i' } }];
    const items = await MergedFile.find(filter).sort(dbSort).limit(500).lean();
    return res.json({ ok: true, items });
  } catch (e) {
    console.error('[m01.listMergedFiles]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// GET /m01/merges/:id - merged file details
export async function getMergedFileDetails(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const workspace = (req.query.workspace as string) || null;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid id' });
    const doc = await MergedFile.findById(id).populate('createdBy', 'fullName email').lean();
    if (!doc) return res.status(404).json({ error: 'not found' });
    if (workspace && String(doc.workspace) !== String(workspace)) return res.status(403).json({ error: 'forbidden' });
    return res.json({ ok: true, item: doc });
  } catch (e) {
    console.error('[m01.getMergedFileDetails]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function getUploadDetails(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const workspace = (req.query.workspace as string) || null;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid id' });
    const doc = await UploadFile.findById(id).populate('uploadedBy', 'fullName email').lean();
    if (!doc) return res.status(404).json({ error: 'not found' });
    if (workspace && String(doc.workspace) !== String(workspace)) return res.status(403).json({ error: 'forbidden' });
    return res.json({ ok: true, item: doc });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function deleteUpload(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const workspace = (req.query.workspace as string) || null;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid id' });
    const doc = await UploadFile.findById(id);
    if (!doc) return res.status(404).json({ error: 'not found' });
    if (workspace && String(doc.workspace) !== String(workspace)) return res.status(403).json({ error: 'forbidden' });

    const db = mongoose.connection.db;
    if (!db) return res.status(500).json({ error: 'db not ready' });
    const bucket = new mongoose.mongo.GridFSBucket(db as any, { bucketName: 'm01_uploads' });

    // Soft-archive: mark the DB record as archived but do NOT delete the GridFS file.
    // Deleting storage is done only on the permanent delete route.
    if (doc.status === 'archived') {
      return res.json({ ok: true, archived: true, alreadyArchived: true });
    }
    doc.status = 'archived';
    doc.archivedAt = new Date();
    await doc.save();
    return res.json({ ok: true, archived: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'internal' });
  }
}

// POST /m01/uploads/:id/restore - restore archived file
export async function restoreUpload(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const workspace = (req.query.workspace as string) || null;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid id' });
    const doc = await UploadFile.findById(id);
    if (!doc) return res.status(404).json({ error: 'not found' });
    if (workspace && String(doc.workspace) !== String(workspace)) return res.status(403).json({ error: 'forbidden' });
    doc.status = 'active';
    doc.archivedAt = undefined as any;
    await doc.save();
    return res.json({ ok: true, restored: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'internal' });
  }
}

// DELETE /m01/uploads/:id/permanent - permanently delete file and record
export async function permanentDeleteUpload(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const workspace = (req.query.workspace as string) || null;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid id' });
    const doc = await UploadFile.findById(id);
    if (!doc) return res.status(404).json({ error: 'not found' });
    if (workspace && String(doc.workspace) !== String(workspace)) return res.status(403).json({ error: 'forbidden' });

    const db = mongoose.connection.db;
    if (!db) return res.status(500).json({ error: 'db not ready' });
    const bucket = new mongoose.mongo.GridFSBucket(db as any, { bucketName: 'm01_uploads' });

    // Check files collection first to avoid calling GridFS delete for missing files
    try {
      const filesColl = db.collection('m01_uploads.files');
      const found = await filesColl.findOne({ _id: doc.fileId });
      if (found) {
        // file exists in GridFS — attempt to delete it. Wrap in try/catch so thrown errors are handled.
        try {
          await new Promise<void>((resolve, reject) => {
            try {
              (bucket as any).delete(doc.fileId, (err: any) => {
                if (err) return reject(err);
                return resolve();
              });
            } catch (err) {
              // some driver versions may throw synchronously
              return reject(err);
            }
          });
        } catch (err) {
          console.error('[m01.permanentDelete] failed to delete GridFS file:', err);
          return res.status(500).json({ error: 'failed to delete file from storage' });
        }
      } else {
        // file not present in GridFS; log and continue to remove DB record
        console.warn('[m01.permanentDelete] GridFS file not found, skipping storage delete', String(doc.fileId));
      }
    } catch (err) {
      console.error('[m01.permanentDelete] error checking GridFS files collection', err);
      return res.status(500).json({ error: 'internal' });
    }

    await UploadFile.deleteOne({ _id: id });
    return res.json({ ok: true, deleted: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'internal' });
  }
}

// POST /m01/uploads/merge - merge selected uploads using provided mappings
export async function mergeUploads(req: Request, res: Response) {
  try {
    const body: any = (req as any).body || {};
    const workspace = body.workspace;
    const name: string | null = body.name || null;
    const uploadIds: string[] = body.uploadIds || [];
    const mappings: Array<{ target: string, source?: string, custom?: boolean, customName?: string }> = body.mappings || [];
    const matchingColumns: Record<string, string> = body.matchingColumns || {};
    const joinType: 'outer'|'inner' = (body.joinType || 'outer');
    const conflictPolicy: 'first_non_empty'|'last_non_empty'|'prefer_file' = (body.conflictPolicy || 'last_non_empty');
    const targetKey: string = body.targetKey || 'lead_id';

    if (!workspace || !mongoose.isValidObjectId(workspace)) return res.status(400).json({ error: 'workspace is required' });
    if (!Array.isArray(uploadIds) || uploadIds.length === 0) return res.status(400).json({ error: 'uploadIds required' });
    if (!Array.isArray(mappings) || mappings.length === 0) return res.status(400).json({ error: 'mappings required' });

    // Validate uploads exist and belong to workspace
  const docs = await UploadFile.find({ _id: { $in: uploadIds } }).lean();
    if (docs.length !== uploadIds.length) return res.status(400).json({ error: 'some uploads not found' });
    for (const d of docs) {
      if (String(d.workspace) !== String(workspace)) return res.status(403).json({ error: 'forbidden' });
      if (d.status === 'archived') return res.status(400).json({ error: 'one of the uploads is archived' });
    }

    // helper to read CSV into array of rows
    const db = mongoose.connection.db;
    if (!db) return res.status(500).json({ error: 'db not ready' });
    const bucket = new mongoose.mongo.GridFSBucket(db as any, { bucketName: 'm01_uploads' });

    const readCsv = (fileId: any) => new Promise<{ header: string[], rows: any[], columnTypes?: string[] }>((resolve, reject) => {
      const download = bucket.openDownloadStream(fileId);
      const allRecords: string[][] = [];
      const parser = parse({ bom: true });
      parser.on('readable', () => {
        let rec: string[] | null;
        while ((rec = parser.read()) !== null) {
          allRecords.push(rec);
        }
      });
      parser.on('end', () => {
        try {
          // detect header among top 2-3 rows, fallback to first row
          const looksLikeHeader = (rec: string[]) => {
            if (!rec || rec.length === 0) return false;
            let numericCount = 0; let alphaCount = 0; let nonEmpty = 0;
            for (const cell of rec) {
              if (cell !== null && typeof cell !== 'undefined' && String(cell).trim() !== '') {
                nonEmpty += 1;
                const s = String(cell).trim();
                if (/^[0-9\-\. ,]+$/.test(s)) numericCount += 1;
                if (/[A-Za-z]/.test(s)) alphaCount += 1;
              }
            }
            if (nonEmpty === 0) return false;
            return (alphaCount > 0 && numericCount / nonEmpty < 0.9);
          };
          let headerIndex = -1;
          const headerScanLimit = Math.min(allRecords.length, 3);
          for (let i = 0; i < headerScanLimit; i++) {
            const candidate = allRecords[i] ?? [];
            if (looksLikeHeader(candidate)) { headerIndex = i; break; }
          }
          if (headerIndex === -1 && allRecords.length > 0) headerIndex = 0;
          const header = (allRecords[headerIndex] ?? []) as string[];
          const dataRows: string[][] = [];
          for (let i = headerIndex + 1; i < allRecords.length; i++) dataRows.push(allRecords[i] ?? []);

          // infer column types from a few rows below header
          const inferTypes = (rows: string[][], cols: number) => {
            const types: string[] = Array.from({ length: cols }, () => 'text');
            const scan = Math.min(rows.length, 5);
            for (let c = 0; c < cols; c++) {
              let isInt = true; let isNumeric = true; let isBool = true; let isDate = true;
              let seenNonEmpty = false;
              for (let r = 0; r < scan; r++) {
                const rowr = rows[r] ?? [];
                const cell = String(rowr[c] ?? '').trim();
                if (cell === '') continue;
                seenNonEmpty = true;
                if (!/^[-+]?\d+$/.test(cell)) isInt = false;
                if (!/^[-+]?\d*[\.,]?\d+$/.test(cell)) isNumeric = false;
                if (!/^(1|0|true|false|yes|no)$/i.test(cell)) isBool = false;
                const d = new Date(cell);
                if (isNaN(d.getTime())) {
                  const parts = cell.split(/[\/\- ]/).map(p => p.trim());
                  if (!(parts.length >= 3 && parts.every(p => /^\d+$/.test(p)))) isDate = false;
                }
              }
              if (!seenNonEmpty) { types[c] = 'text'; continue; }
              if (isInt) types[c] = 'integer';
              else if (isBool) types[c] = 'boolean';
              else if (isNumeric) types[c] = 'numeric';
              else if (isDate) types[c] = 'timestamptz';
              else types[c] = 'text';
            }
            return types;
          };
          const columnTypes = inferTypes(dataRows, (header || []).length);
          return resolve({ header: header as string[], rows: dataRows, columnTypes });
        } catch (e) { return reject(e); }
      });
  parser.on('error', (err: any) => reject(err));
  download.on('error', (err: any) => reject(err));
      download.pipe(parser);
    });

    const fileData: Record<string, { header: string[], rows: any[] }> = {};
    for (const f of docs) {
      // eslint-disable-next-line no-await-in-loop
      const d = await readCsv(f.fileId);
      fileData[String(f._id)] = d;
    }

    // Validate matching columns
    for (const fid of uploadIds) {
      const mc = matchingColumns[fid];
      if (!mc) return res.status(400).json({ error: `matching column required for upload ${fid}` });
      const fd = fileData[fid];
      if (!fd) return res.status(400).json({ error: `failed to read upload ${fid}` });
      if (!fd.header.includes(mc)) return res.status(400).json({ error: `matching column ${mc} not found in upload ${fid}` });
    }

  // Validate required target columns are mapped, excluding the join targetKey (it is populated automatically)
  const requiredTargets = (TARGET_SCHEMA as any[]).filter((c: any) => c.required).map((c: any) => c.key).filter((k: string) => k !== targetKey);
  const mappedTargets = mappings.map(m => m.target).filter(Boolean);
  const missingRequired = requiredTargets.filter((r: string) => !mappedTargets.includes(r));
  if (missingRequired.length > 0) return res.status(400).json({ error: 'required target columns missing', missingRequired });

    // Build per-file key->row maps using the provided matching column
  const perFileMaps: Record<string, Map<string, Record<string, any>>> = {};
  const uploadIdToName: Record<string, string> = {};
  for (const d of docs) uploadIdToName[String(d._id)] = d.filename || d.originalName || String(d._id);
    const counts: Record<string, number> = {};
    for (const fid of uploadIds) {
      const fd = fileData[fid];
      // fd should have been validated earlier; defensively handle missing/empty reads
      if (!fd || !Array.isArray(fd.header)) {
        perFileMaps[fid] = new Map();
        counts[fid] = 0;
        continue;
      }
      const header = fd.header;
      const matchCol = matchingColumns[fid];
      const map = new Map<string, Record<string, any>>();
      let c = 0;
      for (const r of fd.rows || []) {
        const rowAny = r as any[];
        const obj: Record<string, any> = {};
        header.forEach((h, idx) => { obj[h] = rowAny[idx]; });
  const key = String(obj[String(matchCol)] ?? '');
        const existing = map.get(key);
        if (!existing) map.set(key, obj); else Object.assign(existing, obj);
        c += 1;
      }
      perFileMaps[fid] = map;
      counts[fid] = c;
    }

    // Collect full key set (for outer join)
    const allKeys = new Set<string>();
    Object.values(perFileMaps).forEach(m => { for (const k of m.keys()) allKeys.add(k); });

    // Helper: cast value according to target schema type (no validation)
    // We intentionally do not enforce datatypes during merge; accept raw values as-is.
    const castValue = (raw: any, _type: string) => {
      if (raw === null || raw === undefined) return { ok: true, out: '' };
      const s = String(raw).trim();
      return { ok: true, out: s };
    };

    // Prepare target header order and custom fields list
    const nonCustomTargetCols = (mappings.filter(m => !m.custom).map(m => m.target));
    const targetToSource: Record<string, string> = {};
    for (const mm of mappings) {
      if (mm.source) targetToSource[mm.target] = mm.source;
    }

    const outRows: string[][] = [];
  // Datatype validation/warnings disabled: do not collect castErrors
    let rowIndex = 0;
    for (const key of Array.from(allKeys)) {
      if (joinType === 'inner') {
        let presentAll = true;
        for (const fid of uploadIds) {
          const fm = perFileMaps[fid];
          if (!fm || !fm.has(key)) { presentAll = false; break; }
        }
        if (!presentAll) continue;
      }
      const rowVals: string[] = [];
      // Auto-generated sequential id as the first column
      rowIndex += 1;
      rowVals.push(String(rowIndex));
      // The selected targetKey gets the matching key value
      const targetKeyEntry = (TARGET_SCHEMA as any[]).find((c:any) => c.key === targetKey);
      if (targetKeyEntry) {
        const castResForKey = ((type: string) => {
          if (type === 'integer') {
            const n = parseInt(String(key).replace(/[^0-9\-]/g,''), 10);
            return Number.isNaN(n) ? { ok: false, out: '' } : { ok: true, out: String(n) };
          }
          if (type === 'numeric') {
            const n = Number(String(key).replace(/[\s,]/g, ''));
            return Number.isNaN(n) ? { ok: false, out: '' } : { ok: true, out: String(n) };
          }
          return { ok: true, out: String(key) };
        })(targetKeyEntry.type);
  // Type warnings disabled; no cast error collection
        rowVals.push(castResForKey.out);
      } else {
        // If targetKey is not in schema, still place raw key
        rowVals.push(String(key));
      }
      for (const t of nonCustomTargetCols) {
        const src = targetToSource[t];
        let out = '';
        if (t === targetKey) {
          // skip here; we already pushed the key value earlier
          continue;
        }
        if (src) {
          if (src.startsWith('custom::')) {
            const customName = src.split('custom::')[1] || t;
            for (const fid of uploadIds) {
              const fm = perFileMaps[fid];
              if (!fm) continue;
              const r = fm.get(key);
              if (r && (r as any)[customName] !== undefined && String((r as any)[customName]).trim() !== '') { out = String((r as any)[customName]); break; }
            }
          } else {
            const parts = String(src).split('::');
            if (parts.length === 2) {
              const fid = String(parts[0]);
              const col = String(parts[1]);
              const fm = perFileMaps[fid];
              const r = fm ? fm.get(key) : undefined;
              if (r && typeof (r as any)[col] !== 'undefined') out = String((r as any)[col]);
            }
          }
        }
        const targetSchemaEntry = (TARGET_SCHEMA as any[]).find((c:any) => c.key === t);
        const castRes = targetSchemaEntry ? castValue(out, targetSchemaEntry.type) : { ok: true, out };
        rowVals.push(castRes.out);
      }
      outRows.push(rowVals);
    }

  // Build header: id (auto), targetKey, then mapped targets (excluding targetKey)
  const headerLine = ['id', targetKey, ...nonCustomTargetCols.filter(t => t !== targetKey)].join(',');
    const csvLines = [headerLine, ...outRows.map(r => r.map(v => (v && v.includes(',') ? '"' + v.replace(/"/g,'""') + '"' : v)).join(','))];
    const csvText = csvLines.join('\n');

    // persist audit (datatype warnings removed)
    try {
      await MergeAudit.create({ workspace, uploadIds, mapping: mappings, matchingColumns, joinType, conflictPolicy, counts, createdBy: (req as any).user?.id ?? null });
    } catch (e) { /* non-fatal */ console.warn('[m01.merge] failed to persist audit', e); }

    // Save merged CSV to GridFS (bucket m01_merged) and persist a MergedFile record
    const mergedBucket = new mongoose.mongo.GridFSBucket(db as any, { bucketName: 'm01_merged' });
  const filename = (name && typeof name === 'string' && name.trim().length > 0) ? `${name.trim()}.csv` : 'merged.csv';
  const uploadStream = mergedBucket.openUploadStream(filename, { contentType: 'text/csv', metadata: { workspace } });
    await new Promise<void>((resolve, reject) => {
      Readable.from(Buffer.from(csvText, 'utf-8')).pipe(uploadStream)
        .on('error', reject)
        .on('finish', () => resolve());
    });
    const created = await MergedFile.create({
      name: name || null,
      fileId: uploadStream.id,
      filename: uploadStream.filename,
      contentType: 'text/csv',
      length: uploadStream.length,
      workspace,
      createdBy: (req as any).user?.id ?? null,
      uploadIds,
      uploadNames: uploadIds.map((id: string) => uploadIdToName[id] || id),
      mapping: mappings,
      matchingColumns,
      targetKey,
      schemaVersion: TARGET_SCHEMA_VERSION || 'v1',
    });

    return res.json({ ok: true, mergedId: created._id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'internal' });
  }
}

// GET /m01/uploads/consistency - check for uploads whose GridFS file is missing
export async function checkUploadsConsistency(req: Request, res: Response) {
  try {
    const workspace = (req.query.workspace as string) || null;
    const filter: any = {};
    if (workspace) {
      if (!mongoose.isValidObjectId(workspace)) return res.status(400).json({ error: 'invalid workspace id' });
      filter.workspace = workspace;
    }
    const docs = await UploadFile.find(filter).lean();
    const db = mongoose.connection.db;
    if (!db) return res.status(500).json({ error: 'db not ready' });
    const filesColl = db.collection('m01_uploads.files');
    const missing: Array<{ _id: string, filename: string, fileId: any }> = [];
    for (const d of docs) {
      try {
        const found = await filesColl.findOne({ _id: d.fileId });
        if (!found) missing.push({ _id: String(d._id), filename: d.filename, fileId: d.fileId });
      } catch (e) {
        // if lookup fails, treat as missing
        missing.push({ _id: String(d._id), filename: d.filename, fileId: d.fileId });
      }
    }
    return res.json({ ok: true, missing, count: missing.length });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'internal' });
  }
}

// POST /m01/uploads/:id/fix - action: 'archive' | 'delete' - fixes a missing file record
export async function fixUploadRecord(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const action = (req.body && req.body.action) || (req.query.action as string) || null;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid id' });
    const doc = await UploadFile.findById(id);
    if (!doc) return res.status(404).json({ error: 'not found' });
    if (!action || (action !== 'archive' && action !== 'delete')) return res.status(400).json({ error: 'action required: archive|delete' });
    if (action === 'archive') {
      doc.status = 'archived';
      doc.archivedAt = new Date();
      await doc.save();
      return res.json({ ok: true, archived: true });
    }
    // delete record from DB (file already missing)
    await UploadFile.deleteOne({ _id: id });
    return res.json({ ok: true, deleted: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'internal' });
  }
}

// MappingTemplate CRUD endpoints
import MappingTemplate from './models/MappingTemplate.js';

export async function createMappingTemplate(req: Request, res: Response) {
  try {
    const body: any = (req as any).body || {};
    const workspace = body.workspace;
    const name = body.name;
    const schemaVersion = body.schemaVersion || null;
    const mapping = body.mapping;
    if (!workspace || !mongoose.isValidObjectId(workspace)) return res.status(400).json({ error: 'workspace required' });
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name required' });
    if (!mapping) return res.status(400).json({ error: 'mapping required' });

    const created = await MappingTemplate.create({ workspace, name, schemaVersion: schemaVersion || 'v1', mapping, createdBy: (req as any).user?.id ?? null });
    return res.json({ ok: true, id: created._id });
  } catch (e) {
    console.error('[m01.createMappingTemplate]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function listMappingTemplates(req: Request, res: Response) {
  try {
    const workspace = (req.query.workspace as string) || null;
    const filter: any = {};
    if (workspace) {
      if (!mongoose.isValidObjectId(workspace)) return res.status(400).json({ error: 'invalid workspace id' });
      filter.workspace = workspace;
    }
    const items = await MappingTemplate.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ ok: true, items });
  } catch (e) {
    console.error('[m01.listMappingTemplates]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function getMappingTemplate(req: Request, res: Response) {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid id' });
    const doc = await MappingTemplate.findById(id).lean();
    if (!doc) return res.status(404).json({ error: 'not found' });
    // optionally enforce workspace query param
    const workspace = (req.query.workspace as string) || null;
    if (workspace && String(doc.workspace) !== String(workspace)) return res.status(403).json({ error: 'forbidden' });
    return res.json({ ok: true, item: doc });
  } catch (e) {
    console.error('[m01.getMappingTemplate]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function updateMappingTemplate(req: Request, res: Response) {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid id' });
    const body: any = (req as any).body || {};
    const doc = await MappingTemplate.findById(id);
    if (!doc) return res.status(404).json({ error: 'not found' });
    // optional workspace check
    const workspace = body.workspace || (req.query.workspace as string) || null;
    if (workspace && String(doc.workspace) !== String(workspace)) return res.status(403).json({ error: 'forbidden' });
    if (body.name) doc.name = body.name;
    if (body.mapping) doc.mapping = body.mapping;
    if (body.schemaVersion) doc.schemaVersion = body.schemaVersion;
    await doc.save();
    return res.json({ ok: true, id: doc._id });
  } catch (e) {
    console.error('[m01.updateMappingTemplate]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function deleteMappingTemplate(req: Request, res: Response) {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid id' });
    const doc = await MappingTemplate.findById(id);
    if (!doc) return res.status(404).json({ error: 'not found' });
    const workspace = (req.query.workspace as string) || null;
    if (workspace && String(doc.workspace) !== String(workspace)) return res.status(403).json({ error: 'forbidden' });
    await MappingTemplate.deleteOne({ _id: id });
    return res.json({ ok: true, deleted: true });
  } catch (e) {
    console.error('[m01.deleteMappingTemplate]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// =============================
// Leads Code CSVs
// =============================

// Columns to extract for model input (order matters)
const LEADS_MODEL_COLUMNS = [
  'lead_response_time_avg',
  'touchpoint_diversity_score',
  'days_since_first_contact',
  'engagement_consistency_index',
  'sentiment_score_recent',
  'website_visits_last_30d',
  'product_demo_requested',
  'average_meeting_duration',
  'account_activity_index',
  'total_emails_sent',
  'total_open_count',
  'total_click_count',
  'total_reply_count',
  'total_actions',
  'days_since_last_email',
  'days_since_last_action',
  'email_relationship_span_days',
  'open_rate',
  'click_rate',
  'unsubscribe_rate',
  'accepted_connection_count',
  'connection_accept_rate',
  'channel_call',
  'channel_email',
  'channel_linkedin',
  'sales_pressure_index',
  'is_urgent_escalation',
  'rep_priority_bucket',
  'escalation_risk_score',
  'crm_anomaly_flag',
  'random_spike_factor',
  'engagement_score',
  'last_action_type',
];

// Optional fallback names if a given column is missing in merged header
const LEADS_COLUMN_ALIASES: Record<string, string[]> = {
  // model expects 'last_action_type'; merged schema has 'last_action_taken'
  'last_action_type': ['last_action_taken'],
};

// Helper: sanitize feature values for model input
const isCategorical = (col: string) => col === 'last_action_type';
const toNumericString = (raw: any) => {
  if (raw === null || typeof raw === 'undefined') return '0';
  const s = String(raw).trim();
  if (s === '') return '0';
  if (/^(true|yes)$/i.test(s)) return '1';
  if (/^(false|no)$/i.test(s)) return '0';
  // remove commas/spaces
  const cleaned = s.replace(/[\s,]/g, '');
  const n = Number(cleaned);
  if (Number.isFinite(n)) return String(n);
  return '0';
};
const normalizeActionType = (raw: any) => {
  const s = String(raw ?? '').trim();
  if (!s || /^(nan|nat)$/i.test(s)) return 'unknown';
  return s.toUpperCase();
};

// GET /m01/leads - list Leads Code CSVs
export async function listLeadsCodes(req: Request, res: Response) {
  try {
    const workspace = (req.query.workspace as string) || null;
    const q = (req.query.q as string) || '';
    const sort = (req.query.sort as string) || 'createdAt_desc';
    const dbSort: any = {};
    if (sort === 'createdAt_asc') dbSort.createdAt = 1;
    else if (sort === 'name_asc') dbSort.name = 1;
    else if (sort === 'name_desc') dbSort.name = -1;
    else dbSort.createdAt = -1;
    if (workspace && !mongoose.isValidObjectId(workspace)) return res.status(400).json({ error: 'invalid workspace id' });
    const filter: any = workspace ? { workspace } : {};
    if (q && q.trim()) filter.$or = [{ name: { $regex: q, $options: 'i' } }, { filename: { $regex: q, $options: 'i' } }];
    const items = await LeadsCodeFile.find(filter).sort(dbSort).limit(500).lean();
    return res.json({ ok: true, items });
  } catch (e) {
    console.error('[m01.listLeadsCodes]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// GET /m01/leads/:id - details (include createdBy)
export async function getLeadsCodeDetails(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const workspace = (req.query.workspace as string) || null;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid id' });
    const doc = await LeadsCodeFile.findById(id).populate('createdBy', 'fullName email').lean();
    if (!doc) return res.status(404).json({ error: 'not found' });
    if (workspace && String(doc.workspace) !== String(workspace)) return res.status(403).json({ error: 'forbidden' });
    return res.json({ ok: true, item: doc });
  } catch (e) {
    console.error('[m01.getLeadsCodeDetails]', e);
    return res.status(500).json({ error: 'internal' });
  }
}

// GET /m01/leads/:id/preview - preview a leads code CSV from GridFS (bucket m01_leads)
export async function previewLeadsCode(req: Request, res: Response) {
  try {
    const id = String(req.params.id || '');
    const perPage = parseInt(String(req.query.perPage || '20'), 10) || 20;
    const page = parseInt(String(req.query.page || '1'), 10) || 1;
    const workspace = (req.query.workspace as string) || null;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'invalid id' });
    const doc = await LeadsCodeFile.findById(id).lean();
    if (!doc) return res.status(404).json({ error: 'not found' });
    if (workspace && String(doc.workspace) !== String(workspace)) return res.status(403).json({ error: 'forbidden' });
    const db = mongoose.connection.db;
    if (!db) return res.status(500).json({ error: 'db not ready' });
    const bucket = new mongoose.mongo.GridFSBucket(db as any, { bucketName: 'm01_leads' });

    const downloadStream = bucket.openDownloadStream(doc.fileId);
    const PREVIEW_TIMEOUT_MS = 30000;
    let previewTimeout: NodeJS.Timeout | null = setTimeout(() => {
      try { downloadStream.destroy(); } catch (_) {}
      if (!res.headersSent) return res.status(504).json({ error: 'preview timeout' });
    }, PREVIEW_TIMEOUT_MS);

    const RECORD_LIMIT = 500;
    let handled = false;
    const finishWithError = (code = 500, msg = 'parse error') => {
      if (previewTimeout) { clearTimeout(previewTimeout); previewTimeout = null; }
      if (!res.headersSent) return res.status(code).json({ error: msg });
    };
    const processRecords = (bufferRecords: string[][]) => {
      if (handled) return; handled = true;
      if (previewTimeout) { clearTimeout(previewTimeout); previewTimeout = null; }
      try {
        const looksLikeHeader = (rec: string[]) => {
          if (!rec || rec.length === 0) return false;
          let numericCount = 0; let alphaCount = 0; let nonEmpty = 0;
          for (const cell of rec) {
            if (cell !== null && typeof cell !== 'undefined' && String(cell).trim() !== '') {
              nonEmpty += 1;
              const s = String(cell).trim();
              if (/^[0-9\-\. ,]+$/.test(s)) numericCount += 1;
              if (/[A-Za-z]/.test(s)) alphaCount += 1;
            }
          }
          if (nonEmpty === 0) return false;
          return (alphaCount > 0 && numericCount / nonEmpty < 0.9);
        };
        let headerIndex = -1;
        const headerScanLimit = Math.min(bufferRecords.length, 3);
        for (let i = 0; i < headerScanLimit; i++) {
          if (looksLikeHeader(bufferRecords[i] ?? [])) { headerIndex = i; break; }
        }
        if (headerIndex === -1 && bufferRecords.length > 0) headerIndex = 0;
        const header = bufferRecords[headerIndex] ?? [];
        const dataRecords: string[][] = [];
        for (let i = headerIndex + 1; i < bufferRecords.length; i++) dataRecords.push(bufferRecords[i] ?? []);
        const start = (page - 1) * perPage;
        const end = start + perPage;
        const rowsOut: string[][] = [];
        for (let i = start; i < end && i < dataRecords.length; i++) rowsOut.push(dataRecords[i] ?? []);
        const headerPromoted = headerIndex > 0;
        const hasMore = dataRecords.length > end;
        if (!res.headersSent) return res.json({ ok: true, header, rows: rowsOut, page, perPage, hasMore, headerPromoted, headerIndex });
      } catch (e) { return finishWithError(500, 'preview failed'); }
    };
    const parser = parse({ bom: true });
    const bufferRecords: string[][] = [];
    parser.on('readable', () => {
      let rec: string[] | null;
      while ((rec = parser.read()) !== null) {
        bufferRecords.push(rec);
        if (bufferRecords.length >= RECORD_LIMIT) {
          try { downloadStream.destroy(); } catch (_) {}
          try { parser.destroy(); } catch (_) {}
          processRecords(bufferRecords);
          return;
        }
      }
    });
    parser.on('end', () => { if (!handled) processRecords(bufferRecords); });
    parser.on('error', () => { if (!handled) return finishWithError(500, 'parser error'); });
    downloadStream.on('error', () => { if (!handled) return finishWithError(500, 'download error'); });
    downloadStream.pipe(parser);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'internal' });
  }
}

// POST /m01/leads/generate  { workspace, mergedId, name }
export async function generateLeadsCode(req: Request, res: Response) {
  try {
    const body: any = (req as any).body || {};
    const workspace = body.workspace;
    const mergedId = body.mergedId;
    const name: string | null = body.name || null;
    if (!workspace || !mongoose.isValidObjectId(workspace)) return res.status(400).json({ error: 'workspace is required' });
    if (!mergedId || !mongoose.isValidObjectId(mergedId)) return res.status(400).json({ error: 'mergedId is required' });

    const mergedDoc = await MergedFile.findById(mergedId).lean();
    if (!mergedDoc) return res.status(404).json({ error: 'merged file not found' });
    if (String(mergedDoc.workspace) !== String(workspace)) return res.status(403).json({ error: 'forbidden' });

    const db = mongoose.connection.db;
    if (!db) return res.status(500).json({ error: 'db not ready' });
    const mergedBucket = new mongoose.mongo.GridFSBucket(db as any, { bucketName: 'm01_merged' });

    // 1) Read merged CSV fully into memory
    const readCsvFromBucket = (bucket: any, fileId: any) => new Promise<{ header: string[], rows: string[][] }>((resolve, reject) => {
      const download = bucket.openDownloadStream(fileId);
      const allRecords: string[][] = [];
      const parser = parse({ bom: true });
      parser.on('readable', () => {
        let rec: string[] | null;
        while ((rec = parser.read()) !== null) allRecords.push(rec);
      });
      parser.on('end', () => {
        try {
          // detect header
          const looksLikeHeader = (rec: string[]) => {
            if (!rec || rec.length === 0) return false;
            let numericCount = 0; let alphaCount = 0; let nonEmpty = 0;
            for (const cell of rec) {
              if (cell !== null && typeof cell !== 'undefined' && String(cell).trim() !== '') {
                nonEmpty += 1;
                const s = String(cell).trim();
                if (/^[0-9\-\. ,]+$/.test(s)) numericCount += 1;
                if (/[A-Za-z]/.test(s)) alphaCount += 1;
              }
            }
            if (nonEmpty === 0) return false;
            return (alphaCount > 0 && numericCount / nonEmpty < 0.9);
          };
          let headerIndex = -1;
          const headerScanLimit = Math.min(allRecords.length, 3);
          for (let i = 0; i < headerScanLimit; i++) {
            if (looksLikeHeader(allRecords[i] ?? [])) { headerIndex = i; break; }
          }
          if (headerIndex === -1 && allRecords.length > 0) headerIndex = 0;
          const header = (allRecords[headerIndex] ?? []) as string[];
          const dataRows: string[][] = [];
          for (let i = headerIndex + 1; i < allRecords.length; i++) dataRows.push(allRecords[i] ?? []);
          return resolve({ header, rows: dataRows });
        } catch (e) { return reject(e); }
      });
      parser.on('error', (err: any) => reject(err));
      download.on('error', (err: any) => reject(err));
      download.pipe(parser);
    });

    const mergedData = await readCsvFromBucket(mergedBucket as any, mergedDoc.fileId);
    const header = mergedData.header;
    const rows = mergedData.rows;
    const leadIdCol = header.indexOf('lead_id');
    if (leadIdCol === -1) return res.status(400).json({ error: 'lead_id column not found in merged CSV' });

    // 2) Build two tables: with lead_id and without lead_id
    const selectedIndices = LEADS_MODEL_COLUMNS.map(col => {
      const idx = header.indexOf(col);
      if (idx !== -1) return idx;
      const alts = LEADS_COLUMN_ALIASES[col] || [];
      for (const alt of alts) {
        const j = header.indexOf(alt);
        if (j !== -1) return j;
      }
      return -1;
    });
    const missingCols = LEADS_MODEL_COLUMNS.filter((col, i) => selectedIndices[i] === -1);
    if (missingCols.length > 0) return res.status(400).json({ error: 'missing required columns in merged CSV', missing: missingCols });

    const withLeadRows: string[][] = [];
    const withoutLeadRows: string[][] = [];
    for (const r of rows) {
      const leadId = String(r[leadIdCol] ?? '');
      const features: string[] = [];
      for (let i = 0; i < LEADS_MODEL_COLUMNS.length; i++) {
        const col: string = LEADS_MODEL_COLUMNS[i] as string;
        const idx: number = (selectedIndices[i] ?? -1) as number;
        const rawVal = idx >= 0 ? r[idx] : '';
        if (isCategorical(col)) {
          features.push(normalizeActionType(rawVal));
        } else {
          features.push(toNumericString(rawVal));
        }
      }
      withLeadRows.push([leadId, ...features]);
      withoutLeadRows.push(features);
    }

  // 3) Write the 'without lead' sample input to the fixed path expected by testing_catboost.py
  // Per instruction: the ML script only reads apps/ml/data/input/sample_input.csv and writes apps/ml/data/output/output.csv
  const rootDir = path.resolve(__dirname, '../../../../..');
  const mlDir = path.join(rootDir, 'apps', 'ml');
  const inputDir = path.join(mlDir, 'data', 'input');
  const outputDir = path.join(mlDir, 'data', 'output');
  const inputPath = path.join(inputDir, 'sample_input.csv');
  const outputPath = path.join(outputDir, 'output.csv');
  const ts = Date.now();

    fs.mkdirSync(inputDir, { recursive: true });
    fs.mkdirSync(outputDir, { recursive: true });
    const headerLine = LEADS_MODEL_COLUMNS.join(',');
    const inputLines = [headerLine, ...withoutLeadRows.map(r => r.map(v => (v && v.includes(',') ? '"' + v.replace(/"/g,'""') + '"' : v)).join(','))];
    const inputCsvText = inputLines.join('\n');
    fs.writeFileSync(inputPath, inputCsvText, 'utf-8');

    // Also persist the sample_input.csv to GridFS for traceability
    const inputsBucket = new mongoose.mongo.GridFSBucket(db as any, { bucketName: 'm01_leads_inputs' });
    const inputFilename = `sample_input_${ts}.csv`;
    const inputUploadStream = inputsBucket.openUploadStream(inputFilename, { contentType: 'text/csv', metadata: { workspace, mergedId } });
    await new Promise<void>((resolve, reject) => {
      Readable.from(Buffer.from(inputCsvText, 'utf-8')).pipe(inputUploadStream)
        .on('error', reject)
        .on('finish', () => resolve());
    });

    // 4) Run Python inference via testing_catboost.py (now defaulting to RandomForest) with no args
    const pyExe = process.env.M01_ML_PYTHON || process.env.PYTHON || 'python';
    const scriptPath = path.join(mlDir, 'testing_catboost.py');
    const child = spawn(pyExe, [scriptPath], { cwd: mlDir, stdio: 'inherit' });
    const exitCode: number = await new Promise((resolve) => child.on('close', (code) => resolve(code ?? 1)));
    if (exitCode !== 0) return res.status(500).json({ error: 'model inference failed' });

    // 5) Read model output and combine back with lead ids by index
    const outCsv = await new Promise<string>((resolve, reject) => {
      import('fs').then(fs => {
        try { const txt = fs.readFileSync(outputPath, 'utf-8'); resolve(txt); } catch (e) { reject(e as any); }
      });
    });
    const outLines = outCsv.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (outLines.length < 2) return res.status(500).json({ error: 'model output empty' });
    const outHeaderLine = outLines[0] || '';
    const outHeader = outHeaderLine.split(',');
    const outRowsOnly: string[][] = outLines.slice(1).map(line => {
      // naive CSV split by comma; acceptable for controlled outputs
      // handle quoted values by simple replace (testing script produces simple values)
      return line.split(',');
    });
    if (outRowsOnly.length !== withoutLeadRows.length) {
      return res.status(500).json({ error: 'row count mismatch between model output and input' });
    }

    // Persist the raw predictions CSV to GridFS for traceability
    const outputsBucket = new mongoose.mongo.GridFSBucket(db as any, { bucketName: 'm01_leads_outputs' });
    const outputFilename = `output_${ts}.csv`;
    const outputUploadStream = outputsBucket.openUploadStream(outputFilename, { contentType: 'text/csv', metadata: { workspace, mergedId, from: 'testing_catboost.py' } });
    await new Promise<void>((resolve, reject) => {
      Readable.from(Buffer.from(outCsv, 'utf-8')).pipe(outputUploadStream)
        .on('error', reject)
        .on('finish', () => resolve());
    });

    // 6) Build map from lead_id to full merged row
    const leadIdToRow = new Map<string, string[]>();
    for (const r of rows) {
      const k = String(r[leadIdCol] ?? '');
      leadIdToRow.set(k, r);
    }

    // Identify prediction columns from output header
    // Expect: predicted_class, predicted_label, confidence, p_low, p_medium, p_high
    const predCols = ['predicted_class','predicted_label','confidence','p_low','p_medium','p_high'];
    const predIdx = predCols.map(c => outHeader.indexOf(c));

    // 7) Compose final CSV: merged header + prediction columns
    const finalHeader = [...header, ...predCols].join(',');
    const finalLines: string[] = [finalHeader];
    for (let i = 0; i < withLeadRows.length; i++) {
      const leadRow = withLeadRows[i] as string[];
      const leadId: string = (leadRow && leadRow[0]) ? String(leadRow[0]) : '';
      const full = leadIdToRow.get(leadId || '') || [];
      const predsRow = outRowsOnly[i] || [];
      const predVals = predIdx.map(idx => (idx >= 0 ? String(predsRow[idx] ?? '') : ''));
      const safe = (v: string) => (v && v.includes(',') ? '"' + v.replace(/"/g,'""') + '"' : v);
      const line = [...full.map(x => safe(String(x ?? ''))), ...predVals.map(x => safe(String(x ?? '')))].join(',');
      finalLines.push(line);
    }
    const finalCsv = finalLines.join('\n');

    // 8) Save to GridFS (bucket m01_leads) and create LeadsCodeFile record
    const leadsBucket = new mongoose.mongo.GridFSBucket(db as any, { bucketName: 'm01_leads' });
    const filename = (name && typeof name === 'string' && name.trim().length > 0) ? `${name.trim()}.csv` : 'leads.csv';
    const uploadStream = leadsBucket.openUploadStream(filename, { contentType: 'text/csv', metadata: { workspace, mergedId } });
    await new Promise<void>((resolve, reject) => {
      Readable.from(Buffer.from(finalCsv, 'utf-8')).pipe(uploadStream)
        .on('error', reject)
        .on('finish', () => resolve());
    });
    const created = await LeadsCodeFile.create({
      name: name || null,
      fileId: uploadStream.id,
      filename: uploadStream.filename,
      contentType: 'text/csv',
      length: uploadStream.length,
      workspace,
      createdBy: (req as any).user?.id ?? null,
      mergedId,
      inputFileId: inputUploadStream.id,
      inputFilename,
      outputFileId: outputUploadStream.id,
      outputFilename,
    });

    return res.json({ ok: true, leadsId: created._id });
  } catch (e) {
    console.error('[m01.generateLeadsCode]', e);
    return res.status(500).json({ error: 'internal' });
  }
}
