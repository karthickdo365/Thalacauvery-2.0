import bcrypt from "bcryptjs";
import AuthUser from "../models/AuthUser.js";

const createAdmin = async () => {
  const hashedPassword = await bcrypt.hash("admin123", 12);

  await AuthUser.findOneAndUpdate(
    { username: "admin" },
    {
      name: "Admin",
      username: "admin",
      password: hashedPassword,
      role: "admin",
      isActive: true,
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
    }
  );

  console.log("✅ Admin account ready");
};

export default createAdmin;