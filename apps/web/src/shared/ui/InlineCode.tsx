import { Fragment } from "react";

/** Render `backtick` segments of a plain-text message as <code>, e.g. commands in error hints. */
export function InlineCode({ text }: { text: string }) {
  return (
    <>
      {text.split(/`([^`]+)`/g).map((part, index) =>
        index % 2 === 1 ? <code key={index}>{part}</code> : <Fragment key={index}>{part}</Fragment>
      )}
    </>
  );
}
