import { Router, type IRouter } from "express";
import healthRouter from "./health";
import plaidRouter from "./plaid";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

// Health checks stay open for infra probes; everything that touches a real
// bank connection requires the shared access token.
router.use(healthRouter);
router.use(requireAuth, plaidRouter);

export default router;
