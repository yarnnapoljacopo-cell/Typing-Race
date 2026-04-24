import { Router, type IRouter } from "express";
import healthRouter from "./health";
import roomsRouter from "./rooms";
import debugRouter from "./debug";
import bagRouter from "./bag";
import chestsRouter from "./chests";
import craftingRouter from "./crafting";

const router: IRouter = Router();

router.use(healthRouter);
router.use(roomsRouter);
router.use(debugRouter);
router.use(bagRouter);
router.use(chestsRouter);
router.use(craftingRouter);

export default router;
