// src/routes/api/parking/reservations/+server.js - Updated version
import { json } from "@sveltejs/kit";
import { authenticateRequest } from "$lib/auth-middleware.js";
import {
  validateReservationPeriod,
  checkSpaceAvailability,
  getUserReservations,
} from "$lib/parking.js";
import { db } from "$lib/firebase.js";
import { collection, addDoc, doc, getDoc } from "firebase/firestore";

export async function POST({ request }) {
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
    const { spaceId, startDate, endDate, shiftType, scheduleDocument } =
      await request.json();

    // Validate required fields
    if (!spaceId || !startDate || !endDate || !shiftType) {
      return json(
        {
          success: false,
          error:
            "Missing required fields: spaceId, startDate, endDate, shiftType",
        },
        { status: 400 }
      );
    }

    if (spaceId <= 1 || spaceId >= 20) {
      return json(
        {
          success: false,
          error: "Space ID must be between 1 and 20",
        },
        { status: 400 }
      );
    }

    // Validate shift type
    const validShiftTypes = ["8:00-14:00", "14:00-21:00", "9:30-18:30"];
    if (!validShiftTypes.includes(shiftType)) {
      return json(
        {
          success: false,
          error:
            "Invalid shift type. Must be one of: " + validShiftTypes.join(", "),
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

    // Verify space exists
    const spaceDoc = await getDoc(doc(db, "parkingSpaces", spaceId));
    if (!spaceDoc.exists()) {
      return json(
        {
          success: false,
          error: "Parking space not found",
        },
        { status: 404 }
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
        message: "Reservation created successfully",
        reservation: {
          id: docRef.id,
          ...reservationData,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Reservation creation error:", error);
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
    // Authenticate the request
    const authResult = await authenticateRequest(request);

    if (!authResult.success) {
      return json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      );
    }

    const { uid: userId } = authResult.user;

    try {
      const reservations = await getUserReservations(userId);

      // Add space information to each reservation
      const reservationsWithSpaces = await Promise.all(
        reservations.map(async (reservation) => {
          try {
            const spaceDoc = await getDoc(
              doc(db, "parkingSpaces", reservation.spaceId)
            );
            const spaceData = spaceDoc.exists() ? spaceDoc.data() : null;

            return {
              ...reservation,
              space: spaceData,
            };
          } catch (error) {
            console.error("Error fetching space data:", error);
            return {
              ...reservation,
              space: null,
            };
          }
        })
      );

      return json({
        success: true,
        reservations: reservationsWithSpaces,
      });
    } catch (error) {
      console.error("Error fetching reservations:", error);
      return json(
        {
          success: false,
          error: "Failed to fetch reservations",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Authentication error:", error);
    return json(
      {
        success: false,
        error: "Authentication failed",
      },
      { status: 500 }
    );
  }
}
