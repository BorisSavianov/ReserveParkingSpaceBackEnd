import { db } from "./firebase.js";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";

// Initialize parking spaces (run once)
export async function initializeParkingSpaces() {
  const spacesRef = collection(db, "parkingSpaces");
  const snapshot = await getDocs(spacesRef);

  if (snapshot.empty) {
    // Create 20 parking spaces
    for (let i = 1; i <= 20; i++) {
      await setDoc(doc(db, "parkingSpaces", `space-${i}`), {
        spaceId: `space-${i}`,
        spaceNumber: i,
        isActive: true,
        createdAt: new Date().toISOString(),
      });
    }
  }
}

export const SHIFT_TYPES = {
  MORNING: "8:00-14:00",
  AFTERNOON: "14:00-21:00",
  FULL_DAY: "9:30-18:30",
};

export function validateReservationPeriod(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();
  const maxFutureDate = new Date();
  maxFutureDate.setMonth(maxFutureDate.getMonth() + 1); // 1 month ahead

  // Check if dates are valid
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { valid: false, error: "Invalid date format" };
  }

  // Check if start date is not in the past
  if (start < now.setHours(0, 0, 0, 0)) {
    return { valid: false, error: "Cannot reserve parking for past dates" };
  }

  // Check if reservation is not more than 1 month in advance
  if (start > maxFutureDate) {
    return {
      valid: false,
      error: "Cannot reserve parking more than 1 month in advance",
    };
  }

  // Check if end date is after start date
  if (end < start) {
    return { valid: false, error: "End date must be after start date" };
  }

  // Check maximum reservation period (1 week)
  const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  if (daysDiff > 7) {
    return { valid: false, error: "Maximum reservation period is 1 week" };
  }

  return { valid: true };
}

export async function checkSpaceAvailability(
  spaceId,
  startDate,
  endDate,
  shiftType,
  excludeReservationId = null
) {
  const reservationsRef = collection(db, "reservations");
  const q = query(
    reservationsRef,
    where("spaceId", "==", spaceId),
    where("status", "==", "active")
  );

  const snapshot = await getDocs(q);
  const existingReservations = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const requestStart = new Date(startDate);
  const requestEnd = new Date(endDate);

  for (const reservation of existingReservations) {
    // Skip if this is the same reservation being updated
    if (excludeReservationId && reservation.id === excludeReservationId) {
      continue;
    }

    const reservationStart = new Date(reservation.startDate);
    const reservationEnd = new Date(reservation.endDate);

    // Check date overlap
    const datesOverlap =
      requestStart <= reservationEnd && requestEnd >= reservationStart;

    if (datesOverlap) {
      // Check shift conflict
      if (
        reservation.shiftType === SHIFT_TYPES.FULL_DAY ||
        shiftType === SHIFT_TYPES.FULL_DAY
      ) {
        return false; // Full day conflicts with any other reservation
      }

      if (reservation.shiftType === shiftType) {
        return false; // Same shift conflict
      }

      // Morning and afternoon shifts can coexist
      if (
        (reservation.shiftType === SHIFT_TYPES.MORNING &&
          shiftType === SHIFT_TYPES.AFTERNOON) ||
        (reservation.shiftType === SHIFT_TYPES.AFTERNOON &&
          shiftType === SHIFT_TYPES.MORNING)
      ) {
        continue; // No conflict
      }
    }
  }

  return true;
}

export async function getUserReservations(userId) {
  const reservationsRef = collection(db, "reservations");
  const q = query(
    reservationsRef,
    where("userId", "==", userId),
    where("status", "==", "active"),
    orderBy("startDate", "asc")
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

export async function getSpaceReservations(spaceId, date) {
  const targetDate = new Date(date);
  const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
  const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

  const reservationsRef = collection(db, "reservations");
  const q = query(
    reservationsRef,
    where("spaceId", "==", spaceId),
    where("status", "==", "active")
  );

  const snapshot = await getDocs(q);
  const reservations = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // Filter reservations that overlap with the target date
  return reservations.filter((reservation) => {
    const reservationStart = new Date(reservation.startDate);
    const reservationEnd = new Date(reservation.endDate);
    return reservationStart <= endOfDay && reservationEnd >= startOfDay;
  });
}
