import express, { Router } from "express";
import { getSyncStatus, startSync, } from "../controller/upload.controller";
// import upload from "../utils/multerMemory";


const router: Router = express.Router();

// router.post("/upload", upload.single('file'), uploadImages as express.RequestHandler);
router.post("/start-sync", startSync);
router.get("/sync-status/:username", getSyncStatus);

export default router;