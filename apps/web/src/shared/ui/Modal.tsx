import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  size?: "default" | "wide";
  children: ReactNode;
}

/** Accessible dialog (focus trap, Escape, aria labelling) with the app's dialog styling. */
export function Modal({ open, onOpenChange, title, description, size = "default", children }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="ui-dialog-overlay" />
        <Dialog.Content className={`ui-dialog-content${size === "wide" ? " ui-dialog-content--wide" : ""}`}>
          <div className="ui-dialog-header">
            <Dialog.Title className="ui-dialog-title">{title}</Dialog.Title>
            <Dialog.Close className="close-btn" aria-label="Close">
              ✕
            </Dialog.Close>
          </div>
          {description ? (
            <Dialog.Description className="ui-dialog-description">{description}</Dialog.Description>
          ) : (
            <Dialog.Description className="visually-hidden">{title}</Dialog.Description>
          )}
          <div className="ui-dialog-body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
