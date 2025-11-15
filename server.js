const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

const formsRouter = require("./routes/forms");
const workspacesRouter = require("./routes/workspaces");
const publicRouter = require("./routes/public");
const authRouter = require("./routes/auth");
const packagesRouter = require("./routes/packages");
const { authRequired } = require("./middleware/auth");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/packages", packagesRouter);
app.use("/api/forms", authRequired, formsRouter);
app.use("/api/workspaces", authRequired, workspacesRouter);
app.use("/api/public", publicRouter);

const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

app.get("/share/:shareKey", (_req, res) => {
  res.sendFile(path.join(publicDir, "share.html"));
});

app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api")) {
    return res.sendFile(path.join(publicDir, "index.html"));
  }
  return next();
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
