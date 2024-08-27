import { env as privateEnv } from "$env/dynamic/private";
import { env } from "$env/dynamic/public";
import { R2_BUCKET_NAME } from "$env/static/private";
import { S3 } from "$lib/server/S3.js";
import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  type UploadPartCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { json } from "@sveltejs/kit";
import { v4 as uuid } from "uuid";

const PART_SIZE = 5 * 1024 * 1024; // 5MB, this is the minimum chunk size for S3

export async function POST({ request }) {
  const { name: filename, size, type } = await request.json<any>();

  if (!filename || !size || !type) {
    return json({ error: "Invalid request" }, { status: 400 });
  }

  if (size < PART_SIZE) {
    return json(
      { error: "File too small, use normal upload instead" },
      { status: 400 }
    );
  }

  const fileExt = (filename as string).split(".").slice(1).join(".");
  const randomFileName = `${uuid()}.${fileExt}`;

  const { UploadId } = await S3.send(
    new CreateMultipartUploadCommand({
      Bucket: privateEnv.R2_BUCKET_NAME,
      Key: randomFileName,
      ContentType: type,
    })
  );

  if (!UploadId) {
    return json(
      { error: "Failed to create multipart upload" },
      { status: 500 }
    );
  }

  const nbParts = Math.ceil(size / PART_SIZE);

  // generate signed url for each part
  let presignedPartsPromises = [];
  for (let i = 0; i < nbParts; i++) {
    const PartNumber = i + 1;
    presignedPartsPromises.push(
      generateUploadPartPresignedUrl({
        Bucket: privateEnv.R2_BUCKET_NAME,
        Key: randomFileName,
        UploadId,
        PartNumber,
        ContentLength: Math.min(PART_SIZE, size - i * PART_SIZE),
      })
    );
  }

  // time to execute all promises
  let presignedParts = [];
  try {
    presignedParts = await Promise.all(presignedPartsPromises);
  } catch (err) {
    // one of the presigning attemps failed
    return json({ error: "failed to generate presigned url" }, { status: 500 });
  }

  // even though part numbers is array index + 1, we use it in the object for sorting
  // because Promise.all does not guarantee order
  presignedParts.sort((a, b) => a.part - b.part);

  const presignedCompleteMultipartUpload = await getSignedUrl(
    S3,
    new CompleteMultipartUploadCommand({
      Bucket: R2_BUCKET_NAME,
      Key: randomFileName,
      UploadId,
    }),
    { expiresIn: 60 * 60 * 24 }
  );

  // now we send to client an array of presigned UploadPart urls and a presigned CompleteMultipartUpload url
  return json({
    UploadId,
    randomFileName,
    presignedParts,
    presignedCompleteMultipartUpload,
  });
}

// moving logic into function to make it easier to do Promise.all
async function generateUploadPartPresignedUrl(input: UploadPartCommandInput) {
  const presignedUrl = await getSignedUrl(S3, new UploadPartCommand(input), {
    expiresIn: 60 * 60 * 24,
  });

  return { part: input.PartNumber as number, url: presignedUrl };
}
