import { browser } from "$app/environment";
import { writable } from "svelte/store";

type StoredFile = { name: string; url: string; uploadedAt: string };

export const files = writable<StoredFile[]>(
  browser ? JSON.parse(localStorage.getItem("uploadedFiles") || "[]") : []
);

files.subscribe((value) => {
  if (browser) {
    localStorage.setItem("uploadedFiles", JSON.stringify(value));
  }
});

files.update((files) => {
  return files.filter((file) => {
    return (
      new Date(file.uploadedAt).getTime() > Date.now() - 1000 * 60 * 60 * 48
    );
  });
});
