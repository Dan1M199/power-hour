// The Lab's heading and its two pills.

// the Lab's two pages, as pills under its heading
export const LabNav = ({ sub }) => (
  <nav className="filters lab-nav" aria-label="Nerd lab pages">
    <a href="#lab" aria-current={sub ? undefined : 'page'}>The lab</a>
    <a href="#lab/team" aria-current={sub === 'team' ? 'page' : undefined}>Team dashboard</a>
  </nav>
);

export function LabHead({ sub, children }) {
  return (
    <section className="view-head"><div>
      <h1><span className="wk">For the spreadsheet people</span>Nerd Lab</h1>
      <p>{children}</p>
      <LabNav sub={sub} />
    </div></section>
  );
}
