import mongoose, { type Model } from 'mongoose';

const { Schema, model, models } = mongoose;

const Module9MergedDatasetSchema = new Schema({
  title: { type: String, required: true },
  filename: { type: String, required: true },
  fileId: { type: Schema.Types.ObjectId, required: true },
  contentType: { type: String, default: 'text/csv' },
  length: { type: Number },
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  sourceUploadIds: [{ type: Schema.Types.ObjectId, ref: 'UploadFile' }],
  sourceUploadNames: [{ type: String }],
  rowCountBeforeMerge: { type: Number, default: 0 },
  rowCountAfterMerge: { type: Number, default: 0 },
  duplicateCount: { type: Number, default: 0 },
  mergedCount: { type: Number, default: 0 },
  headers: [{ type: String }],
  sampleRows: { type: Schema.Types.Mixed },
  mapping: { type: Schema.Types.Mixed },
  mergeSummary: { type: Schema.Types.Mixed },
  validationSummary: { type: Schema.Types.Mixed },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: false },
  createdAt: { type: Date, default: () => new Date(), index: true },
});

const Module9MergedDataset =
  (models.Module9MergedDataset as Model<any> | undefined) || model<any>('Module9MergedDataset', Module9MergedDatasetSchema);

export default Module9MergedDataset;
