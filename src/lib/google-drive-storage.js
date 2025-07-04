// src/lib/google-drive-storage.js
import { google } from "googleapis";
import { GOOGLE_DRIVE_SERVICE_ACCOUNT } from "$env/static/private";

let drive = null;

/**
 * Initialize Google Drive API client
 */
function initializeDrive() {
  if (drive) return drive;

  try {
    const serviceAccount = JSON.parse(GOOGLE_DRIVE_SERVICE_ACCOUNT);

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });

    drive = google.drive({ version: "v3", auth });
    return drive;
  } catch (error) {
    console.error("Failed to initialize Google Drive:", error);
    throw new Error("Google Drive initialization failed");
  }
}

/**
 * Upload PDF file to Google Drive
 * @param {Buffer} fileBuffer - The PDF file buffer
 * @param {string} fileName - The name of the file
 * @param {string} userId - User ID for folder organization
 * @param {string} reservationId - Reservation ID for file naming
 * @returns {Promise<{success: boolean, fileId?: string, error?: string}>}
 */
export async function uploadPDFToGoogleDrive(
  fileBuffer,
  fileName,
  userId,
  reservationId
) {
  try {
    const driveClient = initializeDrive();

    // Create or get user folder
    const userFolderId = await getOrCreateUserFolder(userId);

    // Create file metadata
    const fileMetadata = {
      name: `${reservationId}_${fileName}`,
      parents: [userFolderId],
      description: `Parking reservation document for reservation ${reservationId}`,
    };

    // Upload file
    const media = {
      mimeType: "application/pdf",
      body: fileBuffer,
    };

    const response = await driveClient.files.create({
      resource: fileMetadata,
      media: media,
      fields: "id, name, size, createdTime",
    });

    // Set file permissions to be readable by the service account
    await driveClient.permissions.create({
      fileId: response.data.id,
      resource: {
        role: "reader",
        type: "anyone",
      },
    });

    return {
      success: true,
      fileId: response.data.id,
      fileName: response.data.name,
      fileSize: response.data.size,
      createdTime: response.data.createdTime,
    };
  } catch (error) {
    console.error("Error uploading to Google Drive:", error);
    return {
      success: false,
      error: error.message || "Failed to upload file to Google Drive",
    };
  }
}

/**
 * Get or create user folder in Google Drive
 * @param {string} userId - User ID
 * @returns {Promise<string>} Folder ID
 */
async function getOrCreateUserFolder(userId) {
  try {
    const driveClient = initializeDrive();

    // Check if user folder exists
    const searchResponse = await driveClient.files.list({
      q: `name='parking_reservations_${userId}' and mimeType='application/vnd.google-apps.folder'`,
      fields: "files(id, name)",
    });

    if (searchResponse.data.files.length > 0) {
      return searchResponse.data.files[0].id;
    }

    // Create user folder
    const folderMetadata = {
      name: `parking_reservations_${userId}`,
      mimeType: "application/vnd.google-apps.folder",
      description: `Parking reservation documents for user ${userId}`,
    };

    const folderResponse = await driveClient.files.create({
      resource: folderMetadata,
      fields: "id",
    });

    return folderResponse.data.id;
  } catch (error) {
    console.error("Error creating user folder:", error);
    throw new Error("Failed to create user folder");
  }
}

/**
 * Download PDF file from Google Drive
 * @param {string} fileId - Google Drive file ID
 * @returns {Promise<{success: boolean, data?: Buffer, error?: string}>}
 */
export async function downloadPDFFromGoogleDrive(fileId) {
  try {
    const driveClient = initializeDrive();

    const response = await driveClient.files.get(
      {
        fileId: fileId,
        alt: "media",
      },
      {
        responseType: "stream",
      }
    );

    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of response.data) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    return {
      success: true,
      data: buffer,
    };
  } catch (error) {
    console.error("Error downloading from Google Drive:", error);
    return {
      success: false,
      error: error.message || "Failed to download file from Google Drive",
    };
  }
}

/**
 * Delete PDF file from Google Drive
 * @param {string} fileId - Google Drive file ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deletePDFFromGoogleDrive(fileId) {
  try {
    const driveClient = initializeDrive();

    await driveClient.files.delete({
      fileId: fileId,
    });

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error deleting from Google Drive:", error);
    return {
      success: false,
      error: error.message || "Failed to delete file from Google Drive",
    };
  }
}

/**
 * Get file metadata from Google Drive
 * @param {string} fileId - Google Drive file ID
 * @returns {Promise<{success: boolean, file?: object, error?: string}>}
 */
export async function getFileMetadata(fileId) {
  try {
    const driveClient = initializeDrive();

    const response = await driveClient.files.get({
      fileId: fileId,
      fields: "id, name, size, createdTime, modifiedTime, mimeType",
    });

    return {
      success: true,
      file: response.data,
    };
  } catch (error) {
    console.error("Error getting file metadata:", error);
    return {
      success: false,
      error: error.message || "Failed to get file metadata",
    };
  }
}

/**
 * Validate PDF file
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - File name
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export function validatePDFFile(fileBuffer, fileName) {
  // Check file size (2MB limit)
  const maxSize = 2 * 1024 * 1024; // 2MB in bytes
  if (fileBuffer.length > maxSize) {
    return {
      valid: false,
      error: "File size exceeds 2MB limit",
    };
  }

  // Check file extension
  if (!fileName.toLowerCase().endsWith(".pdf")) {
    return {
      valid: false,
      error: "Only PDF files are allowed",
    };
  }

  // Check PDF magic number (PDF signature)
  const pdfSignature = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
  if (!fileBuffer.subarray(0, 4).equals(pdfSignature)) {
    return {
      valid: false,
      error: "Invalid PDF file format",
    };
  }

  return {
    valid: true,
  };
}
