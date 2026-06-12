import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clientErrorsRouter from "./clientErrors";
import roomsRouter from "./rooms";
import bagRouter from "./bag";
import chestsRouter from "./chests";
import craftingRouter from "./crafting";
import coinsRouter from "./coins";
import shopRouter from "./shop";
import storageRouter from "./storage";
import guildsRouter from "./guilds";
import questsRouter from "./quests";
import streakRouter from "./streak";
import skinsRouter from "./skins";
import folioRouter from "./folio";
import novelNotesRouter from "./novelNotes";
import coWritingRouter from "./coWriting";

const router: IRouter = Router();

router.use(healthRouter);
router.use(clientErrorsRouter);
router.use(roomsRouter);
router.use(bagRouter);
router.use(chestsRouter);
router.use(craftingRouter);
router.use(coinsRouter);
router.use(shopRouter);
router.use(storageRouter);
router.use(guildsRouter);
router.use(questsRouter);
router.use(streakRouter);
router.use(skinsRouter);
router.use(folioRouter);
router.use(novelNotesRouter);
router.use(coWritingRouter);

export default router;
