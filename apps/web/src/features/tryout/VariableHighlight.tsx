import { splitVariableTokens, variableTokenClass } from "./variable-tokens";

interface VariableHighlightTextProps {
  text: string;
  variables?: Record<string, string>;
  className?: string;
  title?: string;
}

export function VariableHighlightText({
  text,
  variables = {},
  className,
  title
}: VariableHighlightTextProps) {
  const segments = splitVariableTokens(text);

  return (
    <span className={className} title={title}>
      {segments.map((segment, index) =>
        segment.type === "var" ? (
          <mark key={`${segment.name}-${index}`} className={variableTokenClass(segment.name, variables)}>
            {segment.text}
          </mark>
        ) : (
          <span key={`text-${index}`}>{segment.text}</span>
        )
      )}
    </span>
  );
}

interface VariableHighlightInputProps {
  value: string;
  onChange: (value: string) => void;
  variables?: Record<string, string>;
  className?: string;
  placeholder?: string;
  spellCheck?: boolean;
  "aria-label"?: string;
}

export function VariableHighlightInput({
  value,
  onChange,
  variables = {},
  className,
  placeholder,
  spellCheck = false,
  "aria-label": ariaLabel
}: VariableHighlightInputProps) {
  const segments = splitVariableTokens(value);
  const showHighlight = segments.some((segment) => segment.type === "var");

  if (!showHighlight) {
    return (
      <input
        className={className}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        spellCheck={spellCheck}
        aria-label={ariaLabel}
      />
    );
  }

  return (
    <div className={`env-var-input${className ? ` ${className}` : ""}`}>
      <div className="env-var-input-mirror" aria-hidden>
        {segments.map((segment, index) =>
          segment.type === "var" ? (
            <mark key={`${segment.name}-${index}`} className={variableTokenClass(segment.name, variables)}>
              {segment.text}
            </mark>
          ) : (
            <span key={`text-${index}`}>{segment.text || "\u00a0"}</span>
          )
        )}
      </div>
      <input
        className="env-var-input-field"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        spellCheck={spellCheck}
        aria-label={ariaLabel}
      />
    </div>
  );
}
