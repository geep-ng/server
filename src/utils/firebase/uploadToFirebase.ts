import { initFirebase } from "../../config/firebase";
import { getStorage } from "firebase-admin/storage";
// import fs from "fs";

initFirebase();

export async function uploadToFirebase(
  localFilePath: string,
  storagePath: string
): Promise<string> {
  const bucket = getStorage().bucket();
  await bucket.upload(localFilePath, { destination: storagePath });

  const [url] = await bucket.file(storagePath).getSignedUrl({
    action: "read",
    expires: "03-01-2500",
  });

  return url;
}