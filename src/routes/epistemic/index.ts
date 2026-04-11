import { Router } from 'express';
import { eventsRouter } from './epistemicEventsRouter';
import { candidatesRouter } from './epistemicCandidatesRouter';
import { provenanceRouter } from './epistemicProvenanceRouter';
import { maintenanceRouter } from './epistemicMaintenanceRouter';
import { preferencesRouter } from './epistemicPreferencesRouter';

const router = Router();
router.use(eventsRouter);
router.use(candidatesRouter);
router.use(provenanceRouter);
router.use(maintenanceRouter);
router.use(preferencesRouter);

export { router as epistemicRouter };
