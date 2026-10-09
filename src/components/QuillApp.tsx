/** A small Paint window where the quill writes Maxwell Mohammadi; click to write it again. */
import { useState } from "react";
import { AnimatedSignature } from "./SignatureNoteApp";

export function QuillApp() {
  const [run, setRun] = useState(1);
  return (
    <button type="button" className="quill-app" onClick={() => setRun((n) => n + 1)} aria-label="Write the signature again">
      <AnimatedSignature runId={run} />
      <span className="quill-call">KK6OQA</span>
    </button>
  );
}
