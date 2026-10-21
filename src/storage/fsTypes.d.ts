// Declarações mínimas da File System Access API que ainda não estão no lib.dom
// padrão de todas as versões do TypeScript. Cobrem só o que usamos.

interface FileSystemHandlePermissionDescriptor {
  mode?: "read" | "readwrite";
}

interface FileSystemHandle {
  queryPermission?(
    descriptor?: FileSystemHandlePermissionDescriptor
  ): Promise<PermissionState>;
  requestPermission?(
    descriptor?: FileSystemHandlePermissionDescriptor
  ): Promise<PermissionState>;
}

interface DirectoryPickerOptions {
  id?: string;
  mode?: "read" | "readwrite";
  startIn?: FileSystemHandle | string;
}

interface Window {
  showDirectoryPicker?(
    options?: DirectoryPickerOptions
  ): Promise<FileSystemDirectoryHandle>;
}
