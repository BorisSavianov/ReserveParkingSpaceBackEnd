import { json } from "@sveltejs/kit";
import { db } from "$lib/firebase.js";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export async function POST({ params, request }) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const userId = authHeader.split(" ")[1];
    const { reservationId } = params;

    // Get existing reservation
    const reservationDoc = await getDoc(doc(db, "reservations", reservationId));
    if (!reservationDoc.exists()) {
      return json(
        { success: false, error: "Reservation not found" },
        { status: 404 }
      );
    }

    const reservation = reservationDoc.data();

    // Check if user owns this reservation
    if (reservation.userId !== userId) {
      return json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    // Release from current date to end of reservation period
    const today = new Date().toISOString().split("T")[0];

    // Update end date to today (effectively releasing the remaining period)
    await updateDoc(doc(db, "reservations", reservationId), {
      endDate: today,
      releasedAt: new Date().toISOString(),
      status: "released",
    });

    return json({
      success: true,
      message: "Parking space released successfully",
    });
  } catch (error) {
    return json(
      {
        success: false,
        error: "Failed to release parking space",
      },
      { status: 500 }
    );
  }
}
