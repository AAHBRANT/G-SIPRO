export function snapshotSelectedFiles(files: FileList | null): File[] {
  return files ? Array.from(files) : [];
}
