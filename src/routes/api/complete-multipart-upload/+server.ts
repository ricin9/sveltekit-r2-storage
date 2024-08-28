import { S3 } from "$lib/server/S3.js";
import { CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
import { json } from "@sveltejs/kit";

export async function POST({ request }) {
  const body = await request.json<any>();

  console.log(body);
  const response = await S3.send(
    new CompleteMultipartUploadCommand({
      Bucket: body.Bucket,
      Key: body.Key,
      UploadId: body.UploadId,
      MultipartUpload: body.MultipartUpload,
    })
  );

  return json(response);
}
