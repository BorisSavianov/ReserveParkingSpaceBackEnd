import { json } from "@sveltejs/kit";
import { logoutUser } from "$lib/auth.js";

export async function POST() {
  try {
    const result = await logoutUser();
    return json(result, { status: 200 });
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
