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

    const chunk = file.slice(0, 256);

    // try {
    //   await fetch(uploadUrl, {
    //     method: "PUT",
    //     body: file,
    //     headers: {
    //       "Content-Type": file.type,
    //     },
    //   });
    // } catch (error) {
    //   errorMessage = "Failed to upload file";
    //   inProgress = false;
    //   return;
    // }

    $uploadedFiles.unshift({
      name: file.name,
      url: env.PUBLIC_R2_STORAGE_PUBLIC_URL + randomFileName,
    });
    $uploadedFiles = $uploadedFiles; // svelte thing, svelte only reacts with assignment "=" operator is used
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
