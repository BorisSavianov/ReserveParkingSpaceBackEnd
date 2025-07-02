import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
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

    return {
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        firstName,
        lastName,
        department,
        username,
      },
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

    return {
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        ...userData,
      },
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
