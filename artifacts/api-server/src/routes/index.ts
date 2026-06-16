import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import termsRouter from "./terms";
import gameRouter from "./game";
import statsRouter from "./stats";
import logsRouter from "./logs";
import feedbackRouter from "./feedback";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(termsRouter);
router.use(gameRouter);
router.use(statsRouter);
router.use(logsRouter);
router.use(feedbackRouter);

export default router;
