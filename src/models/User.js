const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { ROLES, STATUSES } = require("../utils/constants");

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true, unique: true },
    alternateNumber: { type: String, trim: true, default: "" },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    password: { type: String, required: true, minlength: 6, select: false },
    profileImage: { type: String, default: "" },
    userType: { type: String, enum: Object.values(ROLES), required: true },
    status: { type: String, enum: Object.values(STATUSES), default: STATUSES.ACTIVE },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.set("toJSON", {
  transform(_doc, ret) {
    delete ret.password;
    return ret;
  },
});

module.exports = mongoose.model("User", userSchema);
