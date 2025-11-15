const jwt = require("jsonwebtoken");
const store = require("../data/store");
const { jwtSecret, jwtExpiresIn } = require("../config");

function extractToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (header && header.startsWith("Bearer ")) {
    return header.slice(7);
  }
  if (req.cookies?.token) {
    return req.cookies.token;
  }
  return null;
}

function issueAuthToken(user) {
  const payload = {
    sub: user.id,
    workspaceId: user.workspaceId,
    role: user.role
  };
  return jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn });
}

function authRequired(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const decoded = jwt.verify(token, jwtSecret);
    const user = store.getUser(decoded.sub);
    if (!user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    const workspace = store.getWorkspace(user.workspaceId);
    if (!workspace) {
      return res.status(403).json({ error: "Workspace not found" });
    }
    req.user = user;
    req.workspace = workspace;
    req.authToken = token;
    next();
  } catch (error) {
    console.error("Auth error:", error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = {
  authRequired,
  issueAuthToken
};
