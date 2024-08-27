<script>
  // @ts-nocheck

  import {
    PUBLIC_MAX_FILE_SIZE,
    PUBLIC_R2_STORAGE_PUBLIC_URL,
  } from "$env/static/public";

  import { files as uploadedFiles } from "$lib/client/uploadedFilesStore";

  let errorMessage = "";
  let successMessage = "";

  async function handleFileUpload(event) {
    errorMessage = "";
    successMessage = "";

    const file = event.target.files && event.target.files[0];
    if (!file) {
      errorMessage = "No file selected";
      return;
    }

    console.log(file);

    // get presigned url
    const presignedResponse = await fetch("/api/get-presigned-upload-url/", {
      method: "POST",
      body: JSON.stringify({
        name: file.name,
        size: file.size,
        type: file.type,
      }),
    });

    const { uploadUrl, randomFileName, error } = await presignedResponse.json();
    if (!presignedResponse.ok) {
      errorMessage = error;
      return;
    }

    try {
      await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });
    } catch (error) {
      errorMessage = "Failed to upload file";
      return;
    }

    $uploadedFiles.unshift({
      name: file.name,
      url: PUBLIC_R2_STORAGE_PUBLIC_URL + randomFileName,
    });
    $uploadedFiles = $uploadedFiles; // svelte thing, svelte only reacts with assignment "=" operator is used
  }
</script>

{#if errorMessage}
  <p style="color: red;">{errorMessage}</p>
{/if}
{#if successMessage}
  <p style="color: green;">{successMessage}</p>
{/if}

<p>
  upload a file, max size : {(PUBLIC_MAX_FILE_SIZE / 1024 ** 2).toFixed(2)}MB
</p>
<input type="file" on:change={handleFileUpload} />

<h4>uploaded files</h4>
<ul>
  {#each $uploadedFiles as file}
    <li><a href={file.url}>{file.name}</a></li>
  {/each}
</ul>
