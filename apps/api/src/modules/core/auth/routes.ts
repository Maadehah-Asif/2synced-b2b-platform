import { Router } from "express";
import { signup, login, me, changePassword, googleAuth, googleCallback } from "./controllers.js";

const router = Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/me", me);
router.post("/change-password", changePassword);
router.get("/google", googleAuth);
router.get("/google/callback", googleCallback);

export default router;
