import { json } from "@sveltejs/kit";
import { registerUser } from "$lib/auth.js";

export async function POST({ request }) {
  try {
    const userData = await request.json();

    // Validate required fields
    const { email, password, firstName, lastName, department, username } =
      userData;

    if (
      !email ||
      !password ||
      !firstName ||
      !lastName ||
      !department ||
      !username
    ) {
      return json(
        {
          success: false,
          error: "All fields are required",
        },
        { status: 400 }
      );
    }

    const allowedDepartments = ["frontend", "backend", "mobile", "qa"];

    if (!allowedDepartments.includes(department)) {
      return json(
        {
          success: false,
          error:
            "Invalid department. Must be one of: frontend, backend, mobile, qa",
        },
        { status: 400 }
      );
    }

    if (firstName.length < 1 || firstName.length > 30) {
      return json(
        {
          success: false,
          error: "First name must be between 1 and 30 characters",
        },
        { status: 400 }
      );
    }

    if (lastName.length < 1 || lastName.length > 50) {
      return json(
        {
          success: false,
          error: "Last name must be between 1 and 50 characters",
        },
        { status: 400 }
      );
    }

    if (username.length < 1 || username.length > 50) {
      return json(
        {
          success: false,
          error: "Username must be between 1 and 50 characters",
        },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return json(
        {
          success: false,
          error: "Invalid email format",
        },
        { status: 400 }
      );
    }

    // Password validation
    if (password.length < 6) {
      return json(
        {
          success: false,
          error: "Password must be at least 6 characters long",
        },
        { status: 400 }
      );
    }

    const result = await registerUser(userData);

    if (result.success) {
      return json(result, { status: 201 });
    } else {
      return json(result, { status: 400 });
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
