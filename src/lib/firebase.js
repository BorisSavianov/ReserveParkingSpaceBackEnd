import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCnCWE9Kf0Q7Z2EYqQAbylZq21mqgbji9Y",
  authDomain: "praktika2025-de477.firebaseapp.com",
  projectId: "praktika2025-de477",
  storageBucket: "praktika2025-de477.firebasestorage.app",
  messagingSenderId: "974877167443",
  appId: "1:974877167443:web:6e2d7e5e24e1f6750f1ba6",
  measurementId: "G-WYWE0TBYE7",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
