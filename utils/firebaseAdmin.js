const admin = require("firebase-admin");

let initialized = false;

function initializeFirebase() {
  if (initialized) {
    return admin;
  }

  if (admin.apps.length > 0) {
    initialized = true;
    return admin;
  }

  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountJson) {
      const credentials = JSON.parse(serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(credentials)
      });
      initialized = true;
      return admin;
    }

    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (serviceAccountPath) {
      admin.initializeApp({
        credential: admin.credential.cert(require(serviceAccountPath))
      });
      initialized = true;
      return admin;
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    if (projectId) {
      admin.initializeApp({
        projectId
      });
      initialized = true;
      return admin;
    }

    // Fall back to application default credentials if available.
    admin.initializeApp();
    initialized = true;
    return admin;
  } catch (error) {
    console.warn("Firebase admin initialization failed:", error.message);
    throw error;
  }
}

function getFirebaseAuth() {
  const firebase = initializeFirebase();
  return firebase.auth();
}

module.exports = {
  initializeFirebase,
  getFirebaseAuth
};
