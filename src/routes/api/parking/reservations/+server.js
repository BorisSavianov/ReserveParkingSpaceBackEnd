// src/routes/api/parking/reservations/+server.js - Updated with PDF upload
import { json } from "@sveltejs/kit";
import { authenticateRequest } from "$lib/auth-middleware.js";
import {
  validateReservationPeriod,
  checkSpaceAvailability,
  getUserReservations,
} from "$lib/parking.js";
import {
  uploadPDFToGoogleDrive,
  validatePDFFile,
} from "$lib/google-drive-storage.js";
import { base64ToBuffer } from "$lib/file-upload.js";
import {
  parseMultipartFormData,
  validateUploadedPDF,
} from "$lib/file-upload.js";
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

    // Check content type to determine how to parse the request
    const contentType = request.headers.get("content-type");
    let requestData;
    let pdfFile = null;

    if (contentType && contentType.includes("multipart/form-data")) {
      // Handle multipart form data (file upload)
      const parseResult = await parseMultipartFormData(request);
      if (!parseResult.success) {
        return json(
          { success: false, error: parseResult.error },
          { status: 400 }
        );
      }

      requestData = parseResult.data.fields;

      // Check if PDF file was uploaded
      if (parseResult.data.files.scheduleDocument) {
        pdfFile = parseResult.data.files.scheduleDocument;

        // Validate PDF file
        const validation = await validateUploadedPDF(pdfFile);
        if (!validation.valid) {
          return json(
            { success: false, error: validation.error },
            { status: 400 }
          );
        }
      }
    } else {
      // Handle JSON data (with base64 encoded file)
      requestData = await request.json();

      // Check if base64 PDF data was provided
      if (requestData.pdfData && requestData.pdfFileName) {
        try {
          const pdfBuffer = base64ToBuffer(requestData.pdfData);
          const validation = validatePDFFile(
            pdfBuffer,
            requestData.pdfFileName
          );

          if (!validation.valid) {
            return json(
              { success: false, error: validation.error },
              { status: 400 }
            );
          }

          pdfFile = {
            name: requestData.pdfFileName,
            buffer: pdfBuffer,
            size: pdfBuffer.length,
            type: "application/pdf",
          };
        } catch (error) {
          return json(
            { success: false, error: "Invalid PDF data provided" },
            { status: 400 }
          );
        }
      }
    }

    const { spaceId, startDate, endDate, shiftType } = requestData;

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

    // Validate space ID
    if (spaceId < 1 || spaceId > 20) {
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

    if (daysDiff > 2 && !pdfFile) {
      return json(
        {
          success: false,
          error:
            "PDF schedule document is required for reservations longer than 2 days",
        },
        { status: 400 }
      );
    }

    // Verify space exists
    const spaceDoc = await getDoc(doc(db, "parkingSpaces", `space-${spaceId}`));
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
      `space-${spaceId}`,
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

    // Create reservation first to get the ID
    const reservationData = {
      userId,
      spaceId: `space-${spaceId}`,
      startDate,
      endDate,
      shiftType,
      status: "active",
      createdAt: new Date().toISOString(),
      hasPdfDocument: !!pdfFile,
      pdfDocument: null, // Will be updated after upload
    };

    const docRef = await addDoc(
      collection(db, "reservations"),
      reservationData
    );
    const reservationId = docRef.id;

    // Upload PDF if provided
    let pdfUploadResult = null;
    if (pdfFile) {
      pdfUploadResult = await uploadPDFToGoogleDrive(
        pdfFile.buffer,
        pdfFile.name,
        userId,
        reservationId
      );

      if (!pdfUploadResult.success) {
        // If PDF upload fails, delete the reservation
        await deleteDoc(doc(db, "reservations", reservationId));
        return json(
          {
            success: false,
            error: `Failed to upload PDF: ${pdfUploadResult.error}`,
          },
          { status: 500 }
        );
      }

      // Update reservation with PDF information
      await updateDoc(doc(db, "reservations", reservationId), {
        pdfDocument: {
          fileId: pdfUploadResult.fileId,
          fileName: pdfUploadResult.fileName,
          fileSize: pdfUploadResult.fileSize,
          uploadedAt: pdfUploadResult.createdTime,
        },
      });
    }

    const finalReservationData = {
      ...reservationData,
      id: reservationId,
      ...(pdfUploadResult && {
        pdfDocument: {
          fileId: pdfUploadResult.fileId,
          fileName: pdfUploadResult.fileName,
          fileSize: pdfUploadResult.fileSize,
          uploadedAt: pdfUploadResult.createdTime,
        },
      }),
    };

    return json(
      {
        success: true,
        message: "Reservation created successfully",
        reservation: finalReservationData,
        ...(pdfUploadResult && {
          pdfUpload: {
            success: true,
            fileId: pdfUploadResult.fileId,
            fileName: pdfUploadResult.fileName,
          },
        }),
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
