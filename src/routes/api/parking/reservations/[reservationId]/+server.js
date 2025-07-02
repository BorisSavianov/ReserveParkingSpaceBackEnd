import { json } from "@sveltejs/kit";
import { db } from "$lib/firebase.js";
import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import {
  checkSpaceAvailability,
  validateReservationPeriod,
} from "$lib/parking.js";

export async function PUT({ params, request }) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const userId = authHeader.split(" ")[1];
    const { reservationId } = params;
    const { startDate, endDate, shiftType, scheduleDocument } =
      await request.json();

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

    // Validate new period if dates are being changed
    if (startDate && endDate) {
      const periodValidation = validateReservationPeriod(startDate, endDate);
      if (!periodValidation.valid) {
        return json(
          {
            success: false,
            error: periodValidation.error,
          },
          { status: 400 }
        );
      }

      // Check availability with current reservation excluded
      const isAvailable = await checkSpaceAvailability(
        reservation.spaceId,
        startDate,
        endDate,
        shiftType || reservation.shiftType,
        reservationId
      );

      if (!isAvailable) {
        return json(
          {
            success: false,
            error:
              "Parking space is not available for the selected period and shift",
          },
          { status: 409 }
        );
      }
    }

    // Update reservation
    const updateData = {
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
      ...(shiftType && { shiftType }),
      ...(scheduleDocument !== undefined && { scheduleDocument }),
      updatedAt: new Date().toISOString(),
    };

    await updateDoc(doc(db, "reservations", reservationId), updateData);

    return json({
      success: true,
      message: "Reservation updated successfully",
    });
  } catch (error) {
    return json(
      {
        success: false,
        error: "Failed to update reservation",
      },
      { status: 500 }
    );
  }
}

export async function DELETE({ params, request }) {
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

    // Mark as cancelled instead of deleting
    await updateDoc(doc(db, "reservations", reservationId), {
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
    });

    return json({
      success: true,
      message: "Reservation cancelled successfully",
    });
  } catch (error) {
    return json(
      {
        success: false,
        error: "Failed to cancel reservation",
      },
      { status: 500 }
    );
  }
}
