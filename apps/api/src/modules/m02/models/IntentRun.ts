import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const IntentRunSchema = new Schema({
  leadScoreFile: { type: Schema.Types.ObjectId, ref: 'MergedFile', required: true, index: true },
  fileId: { type: Schema.Types.ObjectId, required: false }, // GridFS file id in bucket m02_intent
  filename: { type: String, required: false },
  contentType: { type: String, default: 'text/csv' },
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  modelVersion: { type: String, default: 'm02-v0.1' },
  status: { type: String, enum: ['processing','success','error'], default: 'processing', index: true },
  rowCountBefore: { type: Number },
  rowCountAfter: { type: Number },
  warnings: { type: Schema.Types.Mixed },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: () => new Date(), index: true },
});

export default model('IntentRun', IntentRunSchema);
