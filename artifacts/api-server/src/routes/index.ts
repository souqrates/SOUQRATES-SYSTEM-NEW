import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import walletRouter from "./wallet";
import referralsRouter from "./referrals";
import botsRouter from "./bots";
import adminRouter from "./admin";
import settingsRouter from "./settings";
import gamesRouter from "./games";
import souqRouter from "./souq";
import subagentRouter from "./subagent";
import { handleWebhookUpdate } from "../lib/setupBots";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/users", usersRouter);
router.use("/wallet", walletRouter);
router.use("/referrals", referralsRouter);
router.use("/bots", botsRouter);
router.use("/admin", adminRouter);
router.use("/settings", settingsRouter);
router.use("/games", gamesRouter);
router.use("/souq", souqRouter);
router.use("/subagent", subagentRouter);

// Telegram webhook endpoints (used in production when Contabo URL is configured)
router.post("/telegram/webhook/:botType", async (req, res) => {
  const botType = req.params.botType as "skillz" | "souq";
  if (botType !== "skillz" && botType !== "souq") {
    res.status(400).json({ error: "Unknown bot type" });
    return;
  }
  res.sendStatus(200); // Always ack immediately
  handleWebhookUpdate(botType, req.body).catch(() => {});
});

export default router;
