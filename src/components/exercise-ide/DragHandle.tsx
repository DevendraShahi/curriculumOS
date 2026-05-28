/** DragHandle — horizontal (col-resize) or vertical (row-resize) splitter */
"use client";

interface DragHandleProps {
  direction: "h" | "v";
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
}

export function DragHandle({ direction, onPointerDown }: DragHandleProps) {
  return (
    <div
      className={direction === "h" ? "ide-drag-h" : "ide-drag-v"}
      onPointerDown={onPointerDown}
      // Prevent text selection while dragging
      onMouseDown={(e) => e.preventDefault()}
    />
  );
}
