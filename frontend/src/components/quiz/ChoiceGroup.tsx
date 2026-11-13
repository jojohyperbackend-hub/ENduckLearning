import { useId } from "react";

export interface Choice<T extends string> {
  value: T;
  label: string;
  hint?: string;
  disabled?: boolean;
}

interface ChoiceGroupProps<T extends string> {
  legend: string;
  name: string;
  choices: Choice<T>[];
  value: T;
  onChange: (value: T) => void;
  // "chips" buat pilihan pendek, "cards" buat pilihan yang butuh keterangan
  variant?: "chips" | "cards";
}

// Radio asli (bisa pakai keyboard panah), tampilannya aja yang dibikin chip/kartu.
const ChoiceGroup = <T extends string>({
  legend,
  name,
  choices,
  value,
  onChange,
  variant = "chips",
}: ChoiceGroupProps<T>) => {
  const groupId = useId();

  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-3 font-heading text-card-header font-bold">{legend}</legend>
      <div
        className={
          variant === "cards"
            ? "grid grid-cols-1 gap-3 sm:grid-cols-2"
            : "flex flex-wrap gap-2"
        }
      >
        {choices.map((choice) => {
          const inputId = `${groupId}-${choice.value}`;
          const isChecked = value === choice.value;
          return (
            <label
              key={choice.value}
              htmlFor={inputId}
              className={`group relative ${choice.disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
            >
              <input
                id={inputId}
                type="radio"
                name={name}
                value={choice.value}
                checked={isChecked}
                disabled={choice.disabled}
                onChange={() => onChange(choice.value)}
                className="peer sr-only"
              />
              <span
                className={`block border-2 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--color-text)] ${
                  variant === "cards" ? "h-full rounded-2xl px-4 py-3" : "rounded-full px-4 py-2"
                } ${
                  isChecked
                    ? "border-[var(--color-text)] bg-[var(--color-text)] text-[var(--color-bg-card)]"
                    : choice.disabled
                      ? "border-[var(--color-text)]/15 bg-[var(--color-bg-card)] text-[var(--color-text)]/45"
                      : "border-[var(--color-text)]/30 bg-[var(--color-bg-card)] hover:border-[var(--color-text)]"
                }`}
              >
                <span className="block text-body-lg font-semibold">{choice.label}</span>
                {choice.hint && (
                  <span
                    className={`mt-0.5 block text-body-sm ${
                      isChecked ? "text-[var(--color-bg-card)]/85" : "text-[var(--color-text)]/70"
                    }`}
                  >
                    {choice.hint}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
};

export default ChoiceGroup;
