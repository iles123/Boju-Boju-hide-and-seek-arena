import { useId, useState } from "react";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  required?: boolean;
  autoComplete?: string;
};

export default function PasswordInput({ label, value, onChange, placeholder, minLength, maxLength, required, autoComplete }: Props) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  return (
    <div className="password-field">
      <label htmlFor={id}>{label}</label>
      <span className="password-input-wrap">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          minLength={minLength}
          maxLength={maxLength}
          required={required}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          title={visible ? "Hide password" : "Show password"}
        >
          {visible ? (
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.2A10.6 10.6 0 0112 5c5 0 9 4.5 10 7-.4 1-1.1 2.2-2.2 3.3M6.2 6.3C4.2 7.7 2.8 9.7 2 12c1 2.5 5 7 10 7 1.4 0 2.7-.3 3.9-.8" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zm10 3a3 3 0 100-6 3 3 0 000 6z" /></svg>
          )}
        </button>
      </span>
    </div>
  );
}
