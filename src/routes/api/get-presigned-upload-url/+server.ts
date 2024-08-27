import { R2_BUCKET_NAME } from "$env/static/private";
import { PUBLIC_MAX_FILE_SIZE } from "$env/static/public";
import { S3 } from "$lib/server/S3.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { json } from "@sveltejs/kit";
import { randomUUID } from "crypto";

export async function POST({ cookies, request }) {
  const { name: filename, size, type } = await request.json<any>();

  if (!filename || !size || !type) {
    return json({ error: "Invalid request" }, { status: 400 });
  }

  if (size > parseInt(PUBLIC_MAX_FILE_SIZE)) {
    return json({ error: "File too large" }, { status: 400 });
  }

  // limit size
  const signableHeaders = new Set<string>();
  signableHeaders.add("content-length");

  const fileExt = (filename as string).split(".").slice(1).join(".");
  const randomFileName = `${randomUUID()}.${fileExt}`;

  const uploadUrl = await getSignedUrl(
    S3,
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: randomFileName,
      ContentLength: size, // 1kb for testing
      ContentType: type,
    }),
    { expiresIn: 60 * 60, signableHeaders }
  );

  return json({ uploadUrl, randomFileName });
}
