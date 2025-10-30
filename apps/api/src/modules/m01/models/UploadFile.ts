import mongoose from "mongoose";

const { Schema, model } = mongoose;

const UploadFileSchema = new Schema({
  fileId: { type: Schema.Types.ObjectId, required: true }, // GridFS file id
  filename: { type: String, required: true },
  originalName: { type: String },
  contentType: { type: String },
  length: { type: Number },
  // Each upload MUST belong to a workspace
  workspace: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
  // Keep uploader history (who uploaded the file)
  uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: false },
  metadata: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: () => new Date(), index: true },
});

export default model("UploadFile", UploadFileSchema);
