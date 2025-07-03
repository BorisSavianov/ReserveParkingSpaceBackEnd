import "dotenv/config";
import admin from "firebase-admin";
import { FIREBASE_SERVICE_ACCOUNT } from "$env/static/private";

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

/**
 * Verify Firebase ID token and extract user information
 * @param {string} token - The Firebase ID token
 * @returns {Promise<{success: boolean, user?: object, error?: string}>}
 */
export async function verifyAuthToken(token) {
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userId = decodedToken.uid;

    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return {
        success: false,
        error: "User not found",
      };
    }

    return {
      success: true,
      user: {
        uid: userId,
        ...userDoc.data(),
      },
    };
  } catch (error) {
    console.error("Token verification error:", error.message);
    return {
      success: false,
      error: "Invalid or expired token",
    };
  }
}

/**
 * Middleware function to authenticate requests
 * @param {Request} request - The incoming request
 * @returns {Promise<{success: boolean, user?: object, error?: string, status?: number}>}
 */
export async function authenticateRequest(request) {
  try {
    const authHeader =
      request.headers.get("authorization") ||
      request.headers.get("Authorization");
    if (!authHeader?.toLowerCase().startsWith("bearer ")) {
      return {
        success: false,
        error: "Missing or invalid Authorization header",
        status: 401,
      };
    }

    const token = authHeader.split(" ")[1];
    const result = await verifyAuthToken(token);
    return result.success
      ? { success: true, user: result.user }
      : { ...result, status: 401 };
  } catch (error) {
    console.error("Authentication error:", error.message);
    return {
      success: false,
      error: "Authentication failed",
      status: 500,
    };
  }
}

/**
 * Extract user ID from authenticated request
 * @param {Request} request - The incoming request
 * @returns {Promise<string|null>}
 */
export async function extractUserId(request) {
  const result = await authenticateRequest(request);
  return result.success ? result.user.uid : null;
}

/**
 * Check if user has specific role
 * @param {object} user - The user object
 * @param {string} requiredRole - The required role
 * @returns {boolean}
 */
export function hasRole(user, requiredRole) {
  return user?.role === requiredRole;
}

/**
 * Middleware for admin-only endpoints
 * @param {Request} request - The incoming request
 * @returns {Promise<{success: boolean, user?: object, error?: string, status?: number}>}
 */
export async function requireAdmin(request) {
  const auth = await authenticateRequest(request);
  if (!auth.success) return auth;

  if (!hasRole(auth.user, "admin")) {
    return {
      success: false,
      error: "Admin access required",
      status: 403,
    };
  }

  return auth;
}
