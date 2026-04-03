import bcrypt from "bcrypt";

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const verifyPassword = async (password: string, storedHash: string): Promise<boolean> => {
  try {
    return await bcrypt.compare(password, storedHash);
  } catch (err) {
    console.error("Password verification error:", err);
    return false;
  }
};
