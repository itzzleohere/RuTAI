import { useEffect, useRef } from "react";

interface OtpInputProps {
  value: string;
  valueLength: number;
  onChange: (value: string) => void;
}

export default function OtpInput({
  value,
  valueLength,
  onChange
}: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus the first input on mount
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const focusInput = (targetIndex: number) => {
    const targetInput = inputRefs.current[targetIndex];
    if (targetInput) {
      targetInput.focus();
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number
  ) => {
    const newValue = e.target.value;
    
    // Only accept numbers
    if (!/^\d*$/.test(newValue)) return;
    
    // Handle paste
    if (newValue.length > 1) {
      // If user pastes multiple characters
      const pastedValue = newValue.substring(0, valueLength);
      
      // Update the value with the pasted content
      onChange(pastedValue.padEnd(valueLength, "").substring(0, valueLength));
      
      // If we've filled all inputs, focus the last one
      if (pastedValue.length === valueLength && inputRefs.current[valueLength - 1]) {
        inputRefs.current[valueLength - 1].focus();
      }
      return;
    }

    // Create a new value string
    const newOtpValue =
      value.substring(0, index) + newValue + value.substring(index + 1);
    
    onChange(newOtpValue);
    
    // Move to next input if current field is filled
    if (newValue !== "" && index < valueLength - 1) {
      focusInput(index + 1);
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) => {
    // Move focus to previous input on backspace
    if (e.key === "Backspace" && !value[index] && index > 0) {
      focusInput(index - 1);
    }
    
    // Move focus with arrow keys
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      focusInput(index - 1);
    }
    
    if (e.key === "ArrowRight" && index < valueLength - 1) {
      e.preventDefault();
      focusInput(index + 1);
    }
  };

  return (
    <div className="flex justify-center gap-2 mb-4">
      {[...Array(valueLength)].map((_, index) => (
        <input
          key={index}
          type="text"
          ref={(ref) => (inputRefs.current[index] = ref)}
          value={value[index] || ""}
          onChange={(e) => handleInputChange(e, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          className="w-12 h-12 text-center text-xl rounded-lg border border-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary"
          maxLength={1}
          autoComplete="one-time-code"
          inputMode="numeric"
        />
      ))}
    </div>
  );
}
