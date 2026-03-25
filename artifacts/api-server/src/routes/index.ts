import { Router, type IRouter } from "express";
import healthRouter from "./health";
import vortexRouter from "./vortex";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(vortexRouter);
router.use(dashboardRouter);

export default router;
