import { browser } from "$app/environment";
import { writable } from "svelte/store";

type StoredFile = { name: string; url: string };

export const files = writable<StoredFile[]>(
  browser ? JSON.parse(localStorage.getItem("uploadedFiles") || "[]") : []
);

files.subscribe((value) => {
  if (browser) {
    localStorage.setItem("uploadedFiles", JSON.stringify(value));
  }
});
