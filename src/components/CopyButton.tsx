import { useState } from 'react';

interface CopyButtonProps {
  value: string;
  label: string;
  className?: string;
}

export default function CopyButton({ value, label, className = '' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const onClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignored — older browsers without clipboard API
    }
  };

  return (
    <button
      onClick={onClick}
      title={`Copy: ${value}`}
      className={`text-xs px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${className}`}
    >
      {copied ? '✓ Copied' : label}
    </button>
  );
}
