// src/lib/auth.js - Enhanced version
import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

export async function registerUser(userData) {
  try {
    const { email, password, firstName, lastName, department, username } =
      userData;

    // Create user with Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    // Store additional user data in Firestore
    await setDoc(doc(db, "users", user.uid), {
      firstName,
      lastName,
      department,
      username,
      email,
      createdAt: new Date().toISOString(),
      role: "employee",
    });

    // Get ID token for immediate use
    const idToken = await user.getIdToken();

    return {
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        firstName,
        lastName,
        department,
        username,
        role: "employee",
      },
      token: idToken,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function loginUser(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    // Get additional user data from Firestore
    const userDoc = await getDoc(doc(db, "users", user.uid));
    const userData = userDoc.data();

    // Get ID token
    const idToken = await user.getIdToken();

    return {
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        ...userData,
      },
      token: idToken,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function logoutUser() {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get current user's ID token
 * @returns {Promise<string|null>}
 */
export async function getCurrentUserToken() {
  try {
    const user = auth.currentUser;
    if (!user) return null;

    return await user.getIdToken();
  } catch (error) {
    console.error("Error getting user token:", error);
    return null;
  }
}

/**
 * Refresh current user's ID token
 * @returns {Promise<string|null>}
 */
export async function refreshUserToken() {
  try {
    const user = auth.currentUser;
    if (!user) return null;

    return await user.getIdToken(true); // Force refresh
  } catch (error) {
    console.error("Error refreshing user token:", error);
    return null;
  }
}

/**
 * Get current authenticated user
 * @returns {Promise<object|null>}
 */
export async function getCurrentUser() {
  try {
    const user = auth.currentUser;
    if (!user) return null;

    const userDoc = await getDoc(doc(db, "users", user.uid));
    const userData = userDoc.data();

    return {
      uid: user.uid,
      email: user.email,
      ...userData,
    };
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
}

/**
 * Listen to authentication state changes
 * @param {Function} callback - Callback function to handle auth state changes
 * @returns {Function} Unsubscribe function
 */
export function onAuthStateChange(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userData = userDoc.data();
        const idToken = await user.getIdToken();

        callback({
          user: {
            uid: user.uid,
            email: user.email,
            ...userData,
          },
          token: idToken,
        });
      } catch (error) {
        console.error("Error in auth state change:", error);
        callback({ user: null, token: null });
      }
    } else {
      callback({ user: null, token: null });
    }
  });
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
export function isAuthenticated() {
  return !!auth.currentUser;
}

/**
 * Create authorization header for API requests
 * @param {string} token - The ID token
 * @returns {object} Headers object
 */
export function createAuthHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

/**
 * API request helper with automatic token handling
 * @param {string} url - API endpoint URL
 * @param {object} options - Fetch options
 * @returns {Promise<Response>}
 */
export async function authenticatedFetch(url, options = {}) {
  const token = await getCurrentUserToken();

  if (!token) {
    throw new Error("No authentication token available");
  }

  const headers = {
    ...createAuthHeaders(token),
    ...options.headers,
  };

  return fetch(url, {
    ...options,
    headers,
  });
}
