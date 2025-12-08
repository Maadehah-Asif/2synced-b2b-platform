import mongoose, { Schema, Types, Model } from "mongoose";

export interface UserDoc {
  _id: Types.ObjectId;
  email: string;
  fullName?: string;
  passwordHash?: string; // present for local auth
  providers?: {
    google?: {
      id: string;
      email?: string;
      picture?: string;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    fullName: { type: String },
    passwordHash: { type: String },
    providers: {
      google: {
        id: { type: String },
        email: { type: String },
        picture: { type: String },
      },
    },
  },
  { timestamps: true }
);

// Index is declared via `unique: true` on the email field above. Avoid duplicate index declarations.

export const User: Model<UserDoc> = (mongoose.models.User as Model<UserDoc>) || mongoose.model<UserDoc>("User", UserSchema);

