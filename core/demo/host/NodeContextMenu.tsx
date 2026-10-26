import { useEffect, useRef, useState } from 'react';
import type { NodeContextMenuEvent } from 'organic-mindmap';

interface NodeContextMenuProps {
  /** The right-click to show the menu for (`onNodeContextMenu`); `null` hides it. */
  readonly target: NodeContextMenuEvent | null;
  /** Requests the delete; returns why it was refused (e.g. the root), else `null`. */
  readonly onDelete: (target: NodeContextMenuEvent) => string | null;
  readonly onClose: () => void;
}

/**
 * The host's own right-click menu on a node, the way a real host (e.g. Obsidian's `Menu`) would offer delete: the
 * library only reports the right-click, the host shows the menu and sends the edit through `requestEdit`.
 * Closes on Escape and on any press outside it; a refusal stays open with its reason.
 */
export function NodeContextMenu({ target, onDelete, onClose }: NodeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  useEffect(() => {
    setRefusal(null);
    if (target === null) return;
    menuRef.current?.querySelector('button')?.focus();
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [target, onClose]);

  if (target === null) return null;
  const deleteNode = () => {
    const reason = onDelete(target);
    if (reason === null) onClose();
    else setRefusal(reason);
  };
  return (
    <div
      ref={menuRef}
      className="context-menu"
      role="menu"
      aria-label="Node actions"
      style={{ left: target.clientPoint.x, top: target.clientPoint.y }}
    >
      <button type="button" className="context-menu__item" role="menuitem" onClick={deleteNode}>
        Delete
      </button>
      {refusal === null ? null : (
        <p className="context-menu__refusal" role="alert">
          {refusal}
        </p>
      )}
    </div>
  );
}
