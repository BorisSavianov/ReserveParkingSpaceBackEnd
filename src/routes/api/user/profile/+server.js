// src/routes/api/user/profile/+server.js - Updated version
import { json } from "@sveltejs/kit";
import { authenticateRequest } from "$lib/auth-middleware.js";
import { db } from "$lib/firebase.js";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export async function GET({ request }) {
  try {
    // Authenticate the request
    const authResult = await authenticateRequest(request);

    if (!authResult.success) {
      return json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      );
    }

    return json({
      success: true,
      user: authResult.user,
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    return json(
      {
        success: false,
        error: "Failed to fetch user profile",
      },
      { status: 500 }
    );
  }
}

export async function PUT({ request }) {
  try {
    // Authenticate the request
    const authResult = await authenticateRequest(request);

    if (!authResult.success) {
      return json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      );
    }

    const { uid: userId } = authResult.user;
    const updateData = await request.json();

    // Define allowed fields for update
    const allowedFields = ["firstName", "lastName", "department", "username"];
    const filteredData = {};

    // Only allow updating specific fields
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    }

    // Validate required fields
    if (Object.keys(filteredData).length === 0) {
      return json(
        {
          success: false,
          error: "No valid fields provided for update",
        },
        { status: 400 }
      );
    }

    // Add update timestamp
    filteredData.updatedAt = new Date().toISOString();

    // Update user document
    await updateDoc(doc(db, "users", userId), filteredData);

    // Get updated user data
    const userDoc = await getDoc(doc(db, "users", userId));
    const userData = userDoc.data();

    return json({
      success: true,
      message: "Profile updated successfully",
      user: {
        uid: userId,
        email: authResult.user.email,
        ...userData,
      },
    });
  } catch (error) {
    console.error("Profile update error:", error);
    return json(
      {
        success: false,
        error: "Failed to update user profile",
      },
      { status: 500 }
    );
  }
}

export async function DELETE({ request }) {
  try {
    // Authenticate the request
    const authResult = await authenticateRequest(request);

    if (!authResult.success) {
      return json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      );
    }

    const { uid: userId } = authResult.user;

    // Soft delete by marking as inactive
    await updateDoc(doc(db, "users", userId), {
      isActive: false,
      deletedAt: new Date().toISOString(),
    });

    return json({
      success: true,
      message: "Account deactivated successfully",
    });
  } catch (error) {
    console.error("Profile deletion error:", error);
    return json(
      {
        success: false,
        error: "Failed to deactivate account",
      },
      { status: 500 }
    );
  }
}
