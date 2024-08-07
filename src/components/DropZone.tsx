import { useCallback, useState } from "preact/hooks";
import { Import } from "../assets/icons/Import";

export function DropZone({
  filetypes,
  onFileDropped,
}: {
  filetypes: string[];
  onFileDropped: (file: File) => void;
}) {
  const [dragging, setDragging] = useState(false);

  const onClickDropZone = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = filetypes.join(",");
    input.onchange = async () => {
      try {
        if (!input.files) return;
        const [file] = Array.from(input.files);
        onFileDropped(file);
      } catch (e) {
        console.error(e);
      }
    };
    input.click();
  }, [onFileDropped, filetypes]);

  // TODO: we don't need to handle multiple files
  const onDrop = useCallback<JSX.DragEventHandler<HTMLDivElement>>(
    (event) => {
      event.preventDefault();
      setDragging(false);
      if (event.dataTransfer?.items) {
        // Use DataTransferItemList interface to access the file(s)
        [...(event.dataTransfer?.items || [])].forEach((item) => {
          // If dropped items aren't files, reject them
          if (item.kind === "file") {
            const file = item.getAsFile();
            if (file) {
              onFileDropped(file);
            }
          }
        });
      } else {
        // Use DataTransfer interface to access the file(s)
        [...(event.dataTransfer?.files || [])].forEach((file) => {
          onFileDropped(file);
        });
      }
    },
    [setDragging, onFileDropped],
  );

  return (
    <div
      id="dropzone"
      style={{ zIndex: 2, cursor: "pointer", position: "relative", flexGrow: 1 }}
      onClick={onClickDropZone}
    >
      <div
        style={{
          display: "flex",
          padding: "16px",
          backgroundColor: dragging ? "#0696D730" : "white",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          border: dragging ? "1px dashed #0696D780" : "1px dashed var(--border-base)",
          borderRadius: "4px",
        }}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDragEnd={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={onDrop}
      >
        <Import />
        <b>Drag & Drop</b>
        Files to import ({filetypes.join(", ")})
      </div>
    </div>
  );
}
