import { Router, type IRouter } from "express";
import healthRouter from "./health";
import roomsRouter from "./rooms";
import debugRouter from "./debug";

const router: IRouter = Router();

router.use(healthRouter);
router.use(roomsRouter);
router.use(debugRouter);

export default router;
