import fs from "fs";

export function load() {
  return {};
  const stream = fs.createReadStream("package.json", {
    encoding: "utf8",
    highWaterMark: 512,
  });

  stream.on("data", (chunk) => {
    console.log("chunk", chunk);
    console.log("[CHUNK LENGTH]", chunk.length);
  });

  stream.on("end", () => {
    console.log("end");
  });

  stream.on("error", (err) => {
    console.error("error", err);
  });
}
