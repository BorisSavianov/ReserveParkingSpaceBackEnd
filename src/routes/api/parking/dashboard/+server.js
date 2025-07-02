import { json } from "@sveltejs/kit";
import { db } from "$lib/firebase.js";
import { collection, getDocs, query, where } from "firebase/firestore";

export async function GET({ url }) {
  try {
    const date =
      url.searchParams.get("date") || new Date().toISOString().split("T")[0];

    // Get all parking spaces
    const spacesRef = collection(db, "parkingSpaces");
    const spacesSnapshot = await getDocs(spacesRef);
    const spaces = spacesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Get all active reservations
    const reservationsRef = collection(db, "reservations");
    const reservationsQuery = query(
      reservationsRef,
      where("status", "==", "active")
    );
    const reservationsSnapshot = await getDocs(reservationsQuery);
    const reservations = reservationsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Filter reservations for the selected date
    const targetDate = new Date(date);
    const dateReservations = reservations.filter((reservation) => {
      const startDate = new Date(reservation.startDate);
      const endDate = new Date(reservation.endDate);
      return startDate <= targetDate && endDate >= targetDate;
    });

    // Build dashboard data
    const dashboard = await Promise.all(
      spaces.map(async (space) => {
        const spaceReservations = dateReservations.filter(
          (r) => r.spaceId === space.id
        );

        const reservationsWithUsers = await Promise.all(
          spaceReservations.map(async (reservation) => {
            try {
              const userDoc = await getDoc(
                doc(db, "users", reservation.userId)
              );
              const userData = userDoc.exists() ? userDoc.data() : null;

              return {
                ...reservation,
                user: userData
                  ? {
                      firstName: userData.firstName,
                      lastName: userData.lastName,
                      username: userData.username,
                      department: userData.department,
                    }
                  : null,
              };
            } catch (error) {
              return {
                ...reservation,
                user: null,
              };
            }
          })
        );

        return {
          ...space,
          reservations: reservationsWithUsers,
          isAvailable: {
            morning: !reservationsWithUsers.some(
              (r) => r.shiftType === "MORNING" || r.shiftType === "FULL_DAY"
            ),
            afternoon: !reservationsWithUsers.some(
              (r) => r.shiftType === "AFTERNOON" || r.shiftType === "FULL_DAY"
            ),
            fullDay: reservationsWithUsers.length === 0,
          },
        };
      })
    );

    return json({
      success: true,
      date,
      spaces: dashboard.sort((a, b) => a.spaceNumber - b.spaceNumber),
    });
  } catch (error) {
    return json(
      {
        success: false,
        error: "Failed to fetch dashboard data",
      },
      { status: 500 }
    );
  }
}
