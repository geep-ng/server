// --- MOCK/SETUP FOR MONGOOSE SyncJob MODEL ---

import mongoose, { Schema } from "mongoose";

// This model tracks the status of the long-running Instagram sync operation.
interface ISyncJob extends Document {
  username: string;
  status: "idle" | "running" | "done" | "error";
  processed: number;
  total: number;
  currentPhase: "posts" | "reels" | "uploading" | "complete";
  errorMessage?: string;
  startedAt: Date;
  completedAt?: Date;
}

const SyncJobSchema: Schema = new Schema({
  username: { type: String, required: true, index: true },
  status: { type: String, enum: ["idle", "running", "done", "error"], default: "running" },
  processed: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  currentPhase: { type: String, enum: ["posts", "reels", "uploading", "complete"], default: "posts" },
  errorMessage: { type: String, required: false },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date, required: false },
});

// Defines the Mongoose model.
// Note: This relies on Mongoose being initialized elsewhere in your application.
export const SyncJob = (mongoose.models.SyncJob as mongoose.Model<ISyncJob>) || mongoose.model<ISyncJob>('SyncJob', SyncJobSchema);
// --- END MOCK/SETUP FOR MONGOOSE ---
