import React from 'react';
import { Check, X } from 'lucide-react';

export function evaluatePassword(password = '') {
  const checks = [
    { key: 'len', label: '8+ characters', pass: password.length >= 8 },
    { key: 'upper', label: 'Uppercase (A-Z)', pass: /[A-Z]/.test(password) },
    { key: 'lower', label: 'Lowercase (a-z)', pass: /[a-z]/.test(password) },
    { key: 'num', label: 'Number (0-9)', pass: /[0-9]/.test(password) },
    { key: 'sym', label: 'Special (@#$!...)', pass: /[^A-Za-z0-9]/.test(password) },
  ];

  const score = checks.filter((c) => c.pass).length;
  const isStrong = score === 5;

  let label = 'Very Weak';
  let color = 'bg-red-500';
  let textColor = 'text-red-400';

  if (score === 5) {
    label = 'Strong';
    color = 'bg-emerald-500';
    textColor = 'text-emerald-400';
  } else if (score === 4) {
    label = 'Good';
    color = 'bg-cyan-500';
    textColor = 'text-cyan-300';
  } else if (score === 3) {
    label = 'Fair';
    color = 'bg-amber-500';
    textColor = 'text-amber-300';
  }

  return { checks, score, isStrong, label, color, textColor };
}

export function isStrongPassword(password = '') {
  return evaluatePassword(password).isStrong;
}

const PasswordStrengthMeter = ({ password = '' }) => {
  if (!password) return null;
  const { checks, score, label, color, textColor } = evaluatePassword(password);

  return (
    <div className="mt-2 p-3 rounded-xl bg-black/30 border border-white/10 space-y-2">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-400 font-medium">Password Strength</span>
        <span className={`font-bold ${textColor}`}>{label}</span>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              score >= n ? color : 'bg-slate-800'
            }`}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-2 gap-y-1 pt-0.5">
        {checks.map((c) => (
          <div
            key={c.key}
            className={`flex items-center gap-1 text-[11px] ${
              c.pass ? 'text-emerald-400' : 'text-slate-500'
            }`}
          >
            {c.pass ? <Check size={11} /> : <X size={11} />}
            <span>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PasswordStrengthMeter;
