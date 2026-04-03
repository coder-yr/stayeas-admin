import express from "express";
import { mountAdminPanel } from "./admin/setupAdmin.js";
import { env } from "./config/env.js";

const start = async () => {
  const app = express();
  
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Request Logger
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
  
  // Static uploads directory
  app.use("/uploads", express.static("../stayease-backend-main/public/uploads"));

  await mountAdminPanel(app);

  app.listen(env.PORT, () => {
    console.log(`AdminJS is running at http://localhost:${env.PORT}/admin`);
  });
};

start().catch((err) => {
  console.error("Failed to start AdminJS:", err);
  process.exit(1);
});
