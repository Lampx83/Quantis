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
      className={`rounded-md px-3 py-1.5 text-sm text-left ${
        selected ? "bg-brand text-white" : "border border-neutral-300 dark:border-neutral-600"
      }`}
    >
      <span className="font-medium">{name}</span>
      {label && <span className="ml-1 opacity-80">— {label}</span>}
    </button>
  );
}
