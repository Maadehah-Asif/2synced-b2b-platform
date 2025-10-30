import { Router } from "express";
import { signup, login, me } from "./controllers.js";
import { changePassword } from "./controllers.js";

const router = Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/me", me);
router.post("/change-password", changePassword);

export default router;
