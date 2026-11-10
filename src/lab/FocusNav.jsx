// A small index within the Lab; content groups remain buttons, not extra site routes.
export function FocusNav({ items, value, onChange, label }) {
  return <div className="focus-index">
    <div className="focus-nav" role="group" aria-label={label}>
      {items.map(([key, title]) => <button key={key} type="button" aria-pressed={value === key} onClick={() => onChange(key)}>{title}</button>)}
    </div>
    <p className="focus-caption">{items.find(([key]) => key === value)?.[2]}</p>
  </div>;
}
