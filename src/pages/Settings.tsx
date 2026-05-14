import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getToken, setToken, clearToken, type TokenKey } from '../lib/tokens';

interface TokenField {
  key: TokenKey;
  label: string;
  help: string;
  link: string;
}

const fields: TokenField[] = [
  {
    key: 'github',
    label: 'GitHub Personal Access Token',
    help: 'Fine-grained token. Read on Pull requests, Issues, Metadata. Add WRITE on Pull requests if you want to use the "Draft PR" and "Add review" buttons.',
    link: 'https://github.com/settings/tokens?type=beta',
  },
  {
    key: 'teamwork',
    label: 'Teamwork API Token',
    help: 'In Teamwork: avatar (top right) → Edit my details → API & Mobile tab → "Show your token".',
    link: 'https://fueled.teamwork.com/',
  },
];

function TokenRow({ field }: { field: TokenField }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(getToken(field.key) ?? '');
  const [saved, setSaved] = useState(false);

  const onSave = () => {
    if (value.trim()) {
      setToken(field.key, value);
    } else {
      clearToken(field.key);
    }
    queryClient.invalidateQueries();
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-md p-4">
      <label className="block text-sm font-medium mb-1">{field.label}</label>
      <p className="text-xs text-slate-500 mb-3">
        {field.help}{' '}
        <a
          href={field.link}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Create one →
        </a>
      </p>
      <div className="flex gap-2">
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="paste token here"
          className="flex-1 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900 font-mono"
        />
        <button
          onClick={onSave}
          className="px-4 py-1.5 text-sm rounded bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
        >
          {saved ? '✓ Saved' : 'Save'}
        </button>
      </div>
    </div>
  );
}

export default function Settings() {
  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold mb-2">Settings</h2>
      <p className="text-sm text-slate-500 mb-6">
        Tokens are stored only in this browser. They never leave your machine.
      </p>
      <div className="space-y-4">
        {fields.map((field) => (
          <TokenRow key={field.key} field={field} />
        ))}
      </div>
    </div>
  );
}
