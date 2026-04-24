import { Router, type IRouter } from "express";
import healthRouter from "./health";
import roomsRouter from "./rooms";
import debugRouter from "./debug";
import bagRouter from "./bag";
import chestsRouter from "./chests";
import craftingRouter from "./crafting";
import coinsRouter from "./coins";
import shopRouter from "./shop";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(roomsRouter);
router.use(debugRouter);
router.use(bagRouter);
router.use(chestsRouter);
router.use(craftingRouter);
router.use(coinsRouter);
router.use(shopRouter);
router.use(storageRouter);

export default router;
