import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Reusable password input with a Show/Hide toggle.
 * Props:
 *   - value, onChange – controlled input props
 *   - placeholder, name – optional
 */
export default function PasswordInput({
  value,
  onChange,
  placeholder = 'Enter password',
  name = 'password',
}) {
  const [show, setShow] = useState(false);
  const toggle = () => setShow((prev) => !prev);

  return (
    <div className="relative w-full">
      <input
        type={show ? 'text' : 'password'}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-4 py-2 pr-10 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        required
      />
      <button
        type="button"
        onClick={toggle}
        className="absolute inset-y-0 right-2 flex items-center text-gray-500 hover:text-gray-700"
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>
    </div>
  );
}
