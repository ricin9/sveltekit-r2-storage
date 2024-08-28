<script lang="ts">
  // @ts-nocheck

  import { env } from "$env/dynamic/public";
  import Spinner from "$lib/client/components/Spinner.svelte";

  import { files as uploadedFiles } from "$lib/client/stores/uploadedFilesStore";

  let errorMessage = "";
  let successMessage = "";
  let inProgress = false;

  async function handleFileUpload(event) {
    errorMessage = "";
    successMessage = "";

    const file: File | undefined = event.target.files && event.target.files[0];
    if (!file) {
      errorMessage = "No file selected";
      return;
    }

    inProgress = true;

    // get presigned url
    const response = await fetch("/api/multipart-upload", {
      method: "POST",
      body: JSON.stringify({
        name: file.name,
        size: file.size,
        type: file.type,
      }),
    });

    const {
      UploadId,
      randomFileName,
      presignedParts,
      presignedCompleteMultipartUpload,
      Bucket,
      Key,
      error,
    } = await response.json();

    if (!response.ok) {
      errorMessage = error;
      inProgress = false;
      return;
    }

    console.log({
      UploadId,
      randomFileName,
      presignedParts,
      presignedCompleteMultipartUpload,
    });

    const CHUNK_SIZE = 5 * 1024 * 1024;

    async function uploadPartHelper({ partNumber, url }, retry = 3) {
      if (retry === 0) {
        console.log(
          `uploading chunk ${partNumber} has failed, and max retry threshold is reached`
        );
        throw new Error(`failed to upload chunk ${partNumber}`);
      }

      console.log(`uploading chunk ${partNumber}`);
      const chunk =
        partNumber === presignedParts.length
          ? file.slice((partNumber - 1) * CHUNK_SIZE)
          : file.slice((partNumber - 1) * CHUNK_SIZE, partNumber * CHUNK_SIZE);

      const response = await fetch(url, { method: "PUT", body: chunk });

      const etag = response.headers.get("Etag");

      if (!response.ok || !etag) {
        console.log(`uploading chunk ${partNumber} has failed, retrying ...`);
        return await uploadPartHelper({ partNumber, url }, retry - 1);
      }

      return { PartNumber: partNumber, ETag: etag };
    }

    // upload file in parts
    const uploadPartsPromises = [];
    for (let i = 0; i < presignedParts.length; i++) {
      uploadPartsPromises.push(
        uploadPartHelper({
          partNumber: presignedParts[i].part,
          url: presignedParts[i].url,
        })
      );
    }

    let uploadedPartsResult = [];
    try {
      uploadedPartsResult = await Promise.all(uploadPartsPromises);
      console.log({ uploadedPartsResult });
    } catch (err) {
      console.log("upload has failed", err);
      return;
    }

    // complete multipart upload
    const completionResponse = await fetch("/api/complete-multipart-upload", {
      method: "POST",
      body: JSON.stringify({
        Bucket,
        Key,
        UploadId,
        MultipartUpload: { Parts: uploadedPartsResult },
      }),
    });

    if (!completionResponse.ok) {
      errorMessage = "Failed to complete multipart upload";
      inProgress = false;
      return;
    }

    const completionResult = await completionResponse.json();
    console.log({ completionResult });

    $uploadedFiles.unshift({
      name: file.name,
      url: env.PUBLIC_R2_STORAGE_PUBLIC_URL + randomFileName,
    });

    $uploadedFiles = $uploadedFiles;

    inProgress = false;
  }
</script>

<body>
  <p>
    Simple file upload using S3 compatible object storage (cloudflare r2 in this
    case) and sveltekit, files are uploaded using presigned url, and maximum
    size is verified using a signed header Content-Length, file names and urls
    are synchronized in local storage, files are auto-deleted after 48 hours
  </p>

  <p id="warning">DO NOT UPLOAD PRIVATE AND SENSITIVE FILES</p>

  <p>
    mutlipart upload is useful for big files as it splits them into small parts
    (chunks) and every part is uploaded independantly using multiple concurrent
    connections
  </p>

  {#if errorMessage}
    <p style="color: red;">{errorMessage}</p>
  {/if}
  {#if successMessage}
    <p style="color: green;">{successMessage}</p>
  {/if}

  <p>upload a file, min size : 5MB</p>
  <input type="file" on:change={handleFileUpload} />
  {#if inProgress}
    uploading ....<Spinner />
  {/if}

  <h4>uploaded files</h4>
  <ul>
    {#each $uploadedFiles as file}
      <li><a href={file.url}>{file.name}</a></li>
    {/each}
  </ul>

  <a
    id="github"
    href="https://github.com/ricin9/sveltekit-r2-storage"
    target="_blank">source code</a
  >
</body>

<style>
  body {
    max-width: 80%;
    margin-left: 8rem;
    margin-right: 8rem;
  }
  #github {
    position: fixed;
    top: 10px;
    right: 10px;
  }

  #warning {
    text-decoration: underline;
  }
</style>
