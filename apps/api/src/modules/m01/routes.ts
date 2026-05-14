import { Router } from "express";
import multer from "multer";
import { uploadFile, listUploads, previewUpload, previewMerged, listMergedFiles, getMergedFileDetails, getUploadDetails, deleteUpload, restoreUpload, permanentDeleteUpload, mergeUploads, checkUploadsConsistency, fixUploadRecord, createMappingTemplate, listMappingTemplates, getMappingTemplate, updateMappingTemplate, deleteMappingTemplate, listLeadsCodes, getLeadsCodeDetails, previewLeadsCode, generateLeadsCode, downloadLeadsCode, getForecastOptions, forecastLeadQuality, getLeadsDashboardData } from "./controllers.js";
import { attachOptionalUser } from "../core/auth/middleware.js";

const router = Router();
// Attach optional user to requests when Authorization header is present
router.use(attachOptionalUser);
const storage = multer.memoryStorage();
const upload = multer({ storage });

// POST /m01/uploads
router.post("/uploads", upload.single("file"), uploadFile);
// GET /m01/uploads
router.get("/uploads", listUploads);
// GET /m01/uploads/:id/preview
router.get("/uploads/:id/preview", previewUpload);
// GET /m01/merges/:id/preview
router.get("/merges/:id/preview", previewMerged);
// GET /m01/merges
router.get("/merges", listMergedFiles);
// GET /m01/merges/:id
router.get("/merges/:id", getMergedFileDetails);
// GET /m01/uploads/:id
router.get("/uploads/:id", getUploadDetails);
// DELETE /m01/uploads/:id
router.delete("/uploads/:id", deleteUpload);
// POST /m01/uploads/:id/restore
router.post("/uploads/:id/restore", restoreUpload);
// DELETE /m01/uploads/:id/permanent
router.delete("/uploads/:id/permanent", permanentDeleteUpload);
// POST /m01/uploads/merge
router.post("/uploads/merge", mergeUploads);
// Mapping template CRUD
router.post('/templates', createMappingTemplate);
router.get('/templates', listMappingTemplates);
router.get('/templates/:id', getMappingTemplate);
router.put('/templates/:id', updateMappingTemplate);
router.delete('/templates/:id', deleteMappingTemplate);
// GET /m01/uploads/consistency - admin check for missing GridFS files
router.get("/uploads/consistency", checkUploadsConsistency);
// POST /m01/uploads/:id/fix - fix an upload record (archive or delete) when storage missing
router.post("/uploads/:id/fix", fixUploadRecord);

// Leads Code
router.get('/leads', listLeadsCodes);
router.get('/leads/:id/dashboard', getLeadsDashboardData);
router.get('/leads/:id/preview', previewLeadsCode);
router.get('/leads/:id/download', downloadLeadsCode);
router.get('/leads/:id', getLeadsCodeDetails);
router.post('/leads/generate', generateLeadsCode);
router.get('/forecast/options', getForecastOptions);
router.post('/forecast', forecastLeadQuality);

export default router;
