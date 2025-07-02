import { json } from "@sveltejs/kit";
import { auth, db } from "$lib/firebase.js";
import { doc, getDoc } from "firebase/firestore";

export async function GET({ request }) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return json(
        {
          success: false,
          error: "Missing or invalid authorization header",
        },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];

    // In a real implementation, you would verify the Firebase ID token here
    // For now, we'll assume the token contains the user ID

    try {
      // This is simplified - in production, use Firebase Admin SDK to verify the token
      const userId = token; // This should be extracted from verified JWT

      const userDoc = await getDoc(doc(db, "users", userId));

      if (!userDoc.exists()) {
        return json(
          {
            success: false,
            error: "User not found",
          },
          { status: 404 }
        );
      }

      const userData = userDoc.data();

      return json({
        success: true,
        user: {
          uid: userId,
          ...userData,
        },
      });
    } catch (error) {
      return json(
        {
          success: false,
          error: "Invalid token",
        },
        { status: 401 }
      );
    }
  } catch (error) {
    return json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
