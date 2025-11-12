const express = require("express");
const bcrypt = require("bcryptjs");
const store = require("../data/store");
const { authRequired, issueAuthToken } = require("../middleware/auth");
const { getFirebaseAuth } = require("../utils/firebaseAdmin");

const router = express.Router();

function setAuthCookie(res, token) {
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 1000 * 60 * 60 * 12
  });
}

function omitSensitiveUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

router.post("/signup", async (req, res) => {
  const { name, email, password, packageId, workspaceName } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  try {
    if (store.getUserByEmail(email)) {
      return res.status(409).json({ error: "Email already registered" });
    }
    const pkg = store.getPackage(packageId) ?? store.listPackages()[0];
    const hashed = await bcrypt.hash(password, 10);
    const workspace = store.createWorkspace({
      name: workspaceName || `${name || "New"}'s Workspace`,
      packageId: pkg?.id ?? null
    });
    const user = store.createUser({
      name: name || "Owner",
      email,
      passwordHash: hashed,
      role: "owner",
      workspaceId: workspace.id
    });
    const updatedWorkspace = store.updateWorkspace(workspace.id, { ownerId: user.id });
    const token = issueAuthToken(user);
    setAuthCookie(res, token);
    res.status(201).json({
      data: {
        token,
        user: omitSensitiveUser(user),
        workspace: updatedWorkspace,
        package: pkg
      }
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Unable to complete signup" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  try {
    const user = store.getUserByEmail(email);
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = issueAuthToken(user);
    setAuthCookie(res, token);
    const workspace = store.getWorkspace(user.workspaceId);
    const pkg = workspace ? store.getPackage(workspace.packageId) : null;
    res.json({
      data: {
        token,
        user: omitSensitiveUser(user),
        workspace,
        package: pkg
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Unable to login" });
  }
});

router.post("/firebase", async (req, res) => {
  const { idToken } = req.body ?? {};
  if (!idToken) {
    return res.status(400).json({ error: "Firebase ID token is required" });
  }
  try {
    const firebaseAuth = getFirebaseAuth();
    const decoded = await firebaseAuth.verifyIdToken(idToken);
    const email = decoded.email;
    if (!email) {
      return res.status(400).json({ error: "Google account email is required" });
    }
    let user = store.getUserByEmail(email);
    let workspace;
    if (!user) {
      const displayName = decoded.name || decoded.email?.split("@")[0] || "Google User";
      workspace = store.createWorkspace({
        name: `${displayName}'s Workspace`
      });
      user = store.createUser({
        name: displayName,
        email,
        passwordHash: "",
        role: "owner",
        workspaceId: workspace.id
      });
      workspace = store.updateWorkspace(workspace.id, { ownerId: user.id });
    } else {
      workspace = store.getWorkspace(user.workspaceId);
      if (!workspace) {
        workspace = store.createWorkspace({
          name: `${user.name || "Workspace"}`
        });
        user = store.updateUser(user.id, { workspaceId: workspace.id });
      }
    }
    const pkg = workspace ? store.getPackage(workspace.packageId) : null;
    const token = issueAuthToken(user);
    setAuthCookie(res, token);
    res.json({
      data: {
        token,
        user: omitSensitiveUser(user),
        workspace,
        package: pkg
      }
    });
  } catch (error) {
    console.error("Firebase login error:", error);
    const status = error.code === "auth/argument-error" ? 400 : 401;
    res.status(status).json({ error: "Unable to verify Google login" });
  }
});

router.post("/logout", (_req, res) => {
  res.clearCookie("token");
  res.status(204).end();
});

router.get("/me", authRequired, (req, res) => {
  const user = req.user;
  const workspace = store.getWorkspace(user.workspaceId);
  const pkg = workspace ? store.getPackage(workspace.packageId) : null;
  res.json({
    data: {
      token: req.authToken,
      user: omitSensitiveUser(user),
      workspace,
      package: pkg
    }
  });
});

module.exports = router;
