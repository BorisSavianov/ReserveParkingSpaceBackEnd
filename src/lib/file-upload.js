// src/lib/file-upload.js
import { validatePDFFile } from "./google-drive-storage.js";

/**
 * Parse multipart form data to extract file and other fields
 * @param {Request} request - The incoming request
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function parseMultipartFormData(request) {
  try {
    const formData = await request.formData();
    const result = {
      fields: {},
      files: {},
    };

    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        // Handle file upload
        const buffer = Buffer.from(await value.arrayBuffer());
        result.files[key] = {
          name: value.name,
          size: value.size,
          type: value.type,
          buffer: buffer,
        };
      } else {
        // Handle regular form fields
        result.fields[key] = value;
      }
    }

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Error parsing multipart form data:", error);
    return {
      success: false,
      error: "Failed to parse form data",
    };
  }
}

/**
 * Validate and process uploaded PDF file
 * @param {object} file - File object from multipart form data
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function validateUploadedPDF(file) {
  if (!file) {
    return {
      valid: false,
      error: "No file provided",
    };
  }

  // Validate file type
  if (file.type !== "application/pdf") {
    return {
      valid: false,
      error: "Only PDF files are allowed",
    };
  }

  // Validate file using the PDF validation function
  return validatePDFFile(file.buffer, file.name);
}

/**
 * Generate unique filename for uploaded documents
 * @param {string} originalName - Original filename
 * @param {string} userId - User ID
 * @param {string} reservationId - Reservation ID
 * @returns {string} Unique filename
 */
export function generateUniqueFileName(originalName, userId, reservationId) {
  const timestamp = new Date().getTime();
  const extension = originalName.toLowerCase().endsWith(".pdf") ? ".pdf" : "";
  const baseName = originalName.replace(/\.[^/.]+$/, ""); // Remove extension

  return `${reservationId}_${userId}_${timestamp}_${baseName}${extension}`;
}

/**
 * Convert base64 string to buffer (for JSON API uploads)
 * @param {string} base64String - Base64 encoded file data
 * @returns {Buffer} File buffer
 */
export function base64ToBuffer(base64String) {
  // Remove data URL prefix if present
  const base64Data = base64String.replace(/^data:application\/pdf;base64,/, "");
  return Buffer.from(base64Data, "base64");
}

/**
 * Convert buffer to base64 string
 * @param {Buffer} buffer - File buffer
 * @returns {string} Base64 encoded string
 */
export function bufferToBase64(buffer) {
  return buffer.toString("base64");
}
