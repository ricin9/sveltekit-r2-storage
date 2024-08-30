<script>
  // @ts-nocheck

  import { env } from "$env/dynamic/public";
  import Spinner from "$lib/client/components/Spinner.svelte";

  import { files as uploadedFiles } from "$lib/client/stores/uploadedFilesStore";

  let errorMessage = "";
  let successMessage = "";
  let inProgress = false;
  let uploadType = "simple";

  // this should really be refactorted into two or more function lol
  async function handleFileUpload(event) {
    errorMessage = "";
    successMessage = "";

    const file = event.target.files && event.target.files[0];
    if (!file) {
      errorMessage = "No file selected";
      return;
    }

    inProgress = true;

    let finalFileName = "";
    if (uploadType === "simple") {
      // get presigned url
      const presignedResponse = await fetch("/api/get-presigned-upload-url/", {
        method: "POST",
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          type: file.type,
        }),
      });

      const { uploadUrl, randomFileName, error } =
        await presignedResponse.json();
      if (!presignedResponse.ok) {
        errorMessage = error;
        inProgress = false;
        return;
      }

      try {
        const response = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        });
      } catch (error) {
        errorMessage = "Failed to upload file";
        inProgress = false;
        return;
      }

      finalFileName = randomFileName;
    } else if (uploadType === "multipart") {
      const response = await fetch("/api/multipart-upload", {
        method: "POST",
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          type: file.type,
        }),
      });

      const { UploadId, randomFileName, presignedParts, Bucket, Key, error } =
        await response.json();

      if (!response.ok) {
        errorMessage = error;
        inProgress = false;
        return;
      }

      const CHUNK_SIZE = 5 * 1024 * 1024;

      async function uploadPartHelper({ partNumber, url }, retry = 3) {
        if (retry === 0) {
          console.log(
            `uploading chunk ${partNumber} has failed, and max retry threshold is reached`,
          );
          throw new Error(`failed to upload chunk ${partNumber}`);
        }

        const chunk =
          partNumber === presignedParts.length
            ? file.slice((partNumber - 1) * CHUNK_SIZE)
            : file.slice(
                (partNumber - 1) * CHUNK_SIZE,
                partNumber * CHUNK_SIZE,
              );

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
          }),
        );
      }

      let uploadedPartsResult = [];
      try {
        uploadedPartsResult = await Promise.all(uploadPartsPromises);
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

      finalFileName = randomFileName;
    }
    $uploadedFiles.unshift({
      name: file.name,
      url: env.PUBLIC_R2_STORAGE_PUBLIC_URL + finalFileName,
      uploadedAt: new Date().toISOString(),
    });
    $uploadedFiles = $uploadedFiles; // svelte thing, svelte only reacts with assignment "=" operator is used
    inProgress = false;
  }
</script>

<body class="bg-gray-100 min-h-screen">
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold mb-6 text-center text-gray-800">
      S3 Compatible Object Storage Upload Demo
    </h1>
    <a
      id="github"
      href="https://github.com/ricin9/sveltekit-r2-storage"
      target="_blank"
      class="fixed bottom-4 right-4 md:bottom-6 md:right-6 bg-gray-800 text-white px-4 py-2 rounded-full hover:bg-gray-700 transition-colors z-50"
    >
      Source Code
    </a>

    <div class="bg-white shadow-md rounded-lg p-6 mb-8">
      <p class="text-gray-700 mb-4">
        This demo showcases simple file uploads using S3 compatible object
        storage (Cloudflare R2 in this case) and SvelteKit. Files are uploaded
        using presigned URLs, and maximum size is verified using a signed
        Content-Length header. File names and URLs are synchronized in local
        storage, and files are automatically deleted after 48 hours.
      </p>
      <p id="warning" class="text-red-600 font-bold mb-4">
        DO NOT UPLOAD PRIVATE AND SENSITIVE FILES
      </p>
      <p class="text-gray-700 mb-4">
        Normal upload is suitable for general-purpose uploads, including small
        to medium files. It uses a single connection.
      </p>

      <p class="text-gray-700 mb-4">
        Multipart upload is suitable for large files, and it uses multiple
        connections to upload parts of the file in parallel. Multipart upload is
        recommended for files larger than 100MB.
      </p>
    </div>

    <div class="bg-white shadow-md rounded-lg p-6 mb-8">
      <h2 class="text-xl font-semibold mb-4">Upload a File</h2>
      <p class="text-gray-700 mb-4">
        Choose the upload type suitable for your file:
      </p>

      <div class="mb-4">
        <label class="inline-flex items-center">
          <input
            type="radio"
            class="form-radio"
            name="uploadType"
            value="simple"
            bind:group={uploadType}
            checked
          />
          <span class="ml-2">Simple Upload</span>
        </label>
        <label class="inline-flex items-center ml-4">
          <input
            type="radio"
            class="form-radio"
            name="uploadType"
            value="multipart"
            bind:group={uploadType}
          />
          <span class="ml-2">Multipart Upload</span>
        </label>
      </div>

      <p class="text-gray-700 mb-2">
        {#if uploadType === "simple"}
          Maximum file size: <span class="font-semibold">10MB</span>
        {:else}
          Minimum file size: <span class="font-semibold">5MB</span>
        {/if}
      </p>
      <div class="mb-4">
        <input
          type="file"
          disabled={inProgress}
          on:change={handleFileUpload}
          class="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-primary file:text-white
                    hover:file:bg-blue-600
                    cursor-pointer disabled:cursor-not-allowed
                "
        />
      </div>
      {#if inProgress}
        <div class="flex items-center text-primary">
          <span class="mr-2">Uploading...</span>
          <Spinner />
        </div>
      {/if}
      {#if errorMessage}
        <p class="text-danger mt-2">{errorMessage}</p>
      {/if}
      {#if successMessage}
        <p class="text-secondary mt-2">{successMessage}</p>
      {/if}
    </div>

    <div class="bg-white shadow-md rounded-lg p-6">
      <h2 class="text-xl font-semibold mb-4">Uploaded Files</h2>
      {#if $uploadedFiles.length === 0}
        <p class="text-gray-500">No files uploaded yet.</p>
      {:else}
        <ul class="space-y-2">
          {#each $uploadedFiles as file}
            <li class="flex justify-between items-center">
              <div>
                <a href={file.url} class="text-primary hover:underline"
                  >{file.name}</a
                >
                {#if file.uploadedAt}
                  <p class="text-sm text-gray-500">
                    Uploaded on: {new Date(file.uploadedAt).toLocaleString([], {
                      timeStyle: "short",
                      dateStyle: "long",
                    })}
                  </p>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
</body>
