import { json } from "@sveltejs/kit";
import {
  validateReservationPeriod,
  checkSpaceAvailability,
  getUserReservations,
} from "$lib/parking.js";
import { db } from "$lib/firebase.js";
import { collection, addDoc, doc, getDoc } from "firebase/firestore";

export async function POST({ request }) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const userId = authHeader.split(" ")[1]; // Simplified token handling

    const { spaceId, startDate, endDate, shiftType, scheduleDocument } =
      await request.json();

    // Validate required fields
    if (!spaceId || !startDate || !endDate || !shiftType) {
      return json(
        {
          success: false,
          error: "Missing required fields",
        },
        { status: 400 }
      );
    }

    // Validate reservation period
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

    // Check if reservation is for more than 2 days and requires document
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    if (daysDiff > 2 && !scheduleDocument) {
      return json(
        {
          success: false,
          error:
            "Schedule document is required for reservations longer than 2 days",
        },
        { status: 400 }
      );
    }

    // Check space availability
    const isAvailable = await checkSpaceAvailability(
      spaceId,
      startDate,
      endDate,
      shiftType
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

    // Create reservation
    const reservationData = {
      userId,
      spaceId,
      startDate,
      endDate,
      shiftType,
      status: "active",
      createdAt: new Date().toISOString(),
      scheduleDocument: scheduleDocument || null,
    };

    const docRef = await addDoc(
      collection(db, "reservations"),
      reservationData
    );

    return json(
      {
        success: true,
        reservation: {
          id: docRef.id,
          ...reservationData,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return json(
      {
        success: false,
        error: "Failed to create reservation",
      },
      { status: 500 }
    );
  }
}

export async function GET({ request }) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const userId = authHeader.split(" ")[1];
    const reservations = await getUserReservations(userId);

    return json({
      success: true,
      reservations,
    });
  } catch (error) {
    return json(
      {
        success: false,
        error: "Failed to fetch reservations",
      },
      { status: 500 }
    );
  }
}
