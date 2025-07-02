import { json } from "@sveltejs/kit";
import { getSpaceReservations } from "$lib/parking.js";

export async function GET({ params, url }) {
  try {
    const { spaceId } = params;
    const date = url.searchParams.get("date");

    if (!date) {
      return json(
        {
          success: false,
          error: "Date parameter is required",
        },
        { status: 400 }
      );
    }

    const reservations = await getSpaceReservations(spaceId, date);

    // Get user data for each reservation
    const reservationsWithUsers = await Promise.all(
      reservations.map(async (reservation) => {
        try {
          const userDoc = await getDoc(doc(db, "users", reservation.userId));
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

    return json({
      success: true,
      reservations: reservationsWithUsers,
    });
  } catch (error) {
    return json(
      {
        success: false,
        error: "Failed to fetch space availability",
      },
      { status: 500 }
    );
  }
}
