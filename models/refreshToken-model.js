import { Schema, model } from "mongoose";
import hashToken from "../utils/hash-token.js";

const refreshTokenSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    token: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0,
    },
  },
  { timestamps: true },
);

refreshTokenSchema.pre("save", function () {
  this.token = hashToken(this.token);
});

export default model("RefreshToken", refreshTokenSchema);
