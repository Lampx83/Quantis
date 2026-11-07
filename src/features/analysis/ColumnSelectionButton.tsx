interface ColumnSelectionButtonProps {
  name: string;
  label: string | null;
  selected: boolean;
  onToggle: (name: string) => void;
}

export function ColumnSelectionButton({ name, label, selected, onToggle }: ColumnSelectionButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(name)}
      aria-pressed={selected}
      className={`rounded-md px-3 py-1.5 text-sm text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 dark:focus-visible:ring-offset-neutral-900 ${
        selected
          ? "bg-brand text-white hover:bg-brand/90"
          : "border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-700/50"
      }`}
    >
      <span className="font-medium">{name}</span>
      {label && <span className="ml-1 opacity-80">— {label}</span>}
    </button>
  );
}
