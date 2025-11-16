import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const MappingTemplateSchema = new Schema({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  name: { type: String, required: true },
  schemaVersion: { type: String, required: true },
  mapping: { type: Schema.Types.Mixed, required: true }, // structure: { <fileId>: { matchingColumn: 'lead_id', mappings: { sourceCol: targetCol } } }
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: false },
  createdAt: { type: Date, default: () => new Date() },
}, { timestamps: false });

export default model('MappingTemplate', MappingTemplateSchema);
