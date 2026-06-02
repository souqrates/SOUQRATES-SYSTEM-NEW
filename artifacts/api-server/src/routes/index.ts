import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import walletRouter from "./wallet";
import referralsRouter from "./referrals";
import botsRouter from "./bots";
import adminRouter from "./admin";
import settingsRouter from "./settings";
import gamesRouter from "./games";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/users", usersRouter);
router.use("/wallet", walletRouter);
router.use("/referrals", referralsRouter);
router.use("/bots", botsRouter);
router.use("/admin", adminRouter);
router.use("/settings", settingsRouter);
router.use("/games", gamesRouter);

export default router;
