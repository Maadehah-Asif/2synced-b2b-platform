import { Router } from "express";
import multer from "multer";
import { uploadFile, listUploads, previewUpload } from "./controllers.js";

const router = Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

// POST /m01/uploads
router.post("/uploads", upload.single("file"), uploadFile);
// GET /m01/uploads
router.get("/uploads", listUploads);
// GET /m01/uploads/:id/preview
router.get("/uploads/:id/preview", previewUpload);

export default router;
