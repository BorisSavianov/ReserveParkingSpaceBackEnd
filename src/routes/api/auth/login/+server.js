import { json } from "@sveltejs/kit";
import { loginUser } from "$lib/auth.js";

export async function POST({ request }) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return json(
        {
          success: false,
          error: "Email and password are required",
        },
        { status: 400 }
      );
    }

    const result = await loginUser(email, password);

    if (result.success) {
      return json(result, { status: 200 });
    } else {
      return json(result, { status: 401 });
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
