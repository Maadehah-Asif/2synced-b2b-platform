import { Router } from "express";
import {
  bootstrapAssistant,
  replyAsAdmin,
  sendFaqMessage,
  submitCustomQuestion,
} from "./controllers.js";

const router = Router();

router.get("/", (_req, res) => res.json({ ok: true, module: "m04" }));
router.get("/assistant", bootstrapAssistant);
router.post("/assistant/faq", sendFaqMessage);
router.post("/assistant/question", submitCustomQuestion);
router.post("/assistant/reply", replyAsAdmin);

export default router;
