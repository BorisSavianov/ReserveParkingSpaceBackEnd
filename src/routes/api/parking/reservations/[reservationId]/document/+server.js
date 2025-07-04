// src/routes/api/parking/reservations/[reservationId]/document/+server.js
import { json } from "@sveltejs/kit";
import { authenticateRequest } from "$lib/auth-middleware.js";
import {
  downloadPDFFromGoogleDrive,
  getFileMetadata,
} from "$lib/google-drive-storage.js";
import { db } from "$lib/firebase.js";
import { doc, getDoc } from "firebase/firestore";

export async function GET({ params, request }) {
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
    const { reservationId } = params;

    // Get reservation to verify ownership and get PDF file ID
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

    // Check if reservation has a PDF document
    if (!reservation.pdfDocument || !reservation.pdfDocument.fileId) {
      return json(
        { success: false, error: "No PDF document found for this reservation" },
        { status: 404 }
      );
    }

    // Download the PDF from Google Drive
    const downloadResult = await downloadPDFFromGoogleDrive(
      reservation.pdfDocument.fileId
    );

    if (!downloadResult.success) {
      return json(
        { success: false, error: downloadResult.error },
        { status: 500 }
      );
    }

    // Return the PDF file as a response
    return new Response(downloadResult.data, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${reservation.pdfDocument.fileName}"`,
        "Content-Length": downloadResult.data.length.toString(),
      },
    });
  } catch (error) {
    console.error("PDF download error:", error);
    return json(
      {
        success: false,
        error: "Failed to download PDF document",
      },
      { status: 500 }
    );
  }
}

export async function DELETE({ params, request }) {
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
    const { reservationId } = params;

    // Get reservation to verify ownership and get PDF file ID
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

    // Check if reservation has a PDF document
    if (!reservation.pdfDocument || !reservation.pdfDocument.fileId) {
      return json(
        { success: false, error: "No PDF document found for this reservation" },
        { status: 404 }
      );
    }

    // Delete the PDF from Google Drive
    const deleteResult = await deletePDFFromGoogleDrive(
      reservation.pdfDocument.fileId
    );

    if (!deleteResult.success) {
      return json(
        { success: false, error: deleteResult.error },
        { status: 500 }
      );
    }

    // Update reservation to remove PDF document reference
    await updateDoc(doc(db, "reservations", reservationId), {
      pdfDocument: null,
      hasPdfDocument: false,
      documentDeletedAt: new Date().toISOString(),
    });

    return json({
      success: true,
      message: "PDF document deleted successfully",
    });
  } catch (error) {
    console.error("PDF deletion error:", error);
    return json(
      {
        success: false,
        error: "Failed to delete PDF document",
      },
      { status: 500 }
    );
  }
}

export async function HEAD({ params, request }) {
  try {
    // Authenticate the request
    const authResult = await authenticateRequest(request);

    if (!authResult.success) {
      return new Response(null, { status: authResult.status });
    }

    const { uid: userId } = authResult.user;
    const { reservationId } = params;

    // Get reservation to verify ownership and get PDF file ID
    const reservationDoc = await getDoc(doc(db, "reservations", reservationId));
    if (!reservationDoc.exists()) {
      return new Response(null, { status: 404 });
    }

    const reservation = reservationDoc.data();

    // Check if user owns this reservation
    if (reservation.userId !== userId) {
      return new Response(null, { status: 403 });
    }

    // Check if reservation has a PDF document
    if (!reservation.pdfDocument || !reservation.pdfDocument.fileId) {
      return new Response(null, { status: 404 });
    }

    // Get file metadata
    const metadataResult = await getFileMetadata(
      reservation.pdfDocument.fileId
    );

    if (!metadataResult.success) {
      return new Response(null, { status: 500 });
    }

    // Return headers with file information
    return new Response(null, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": metadataResult.file.size,
        "Last-Modified": new Date(
          metadataResult.file.modifiedTime
        ).toUTCString(),
        "X-File-Name": reservation.pdfDocument.fileName,
      },
    });
  } catch (error) {
    console.error("PDF metadata error:", error);
    return new Response(null, { status: 500 });
  }
}
