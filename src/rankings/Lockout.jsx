// The power rankings while a week is being played (Dan's request, Nov 6): the ranks would keep shifting with every
// snapshot, so the page is closed off by a popup until the week is final. The popup is a play clock counting down to
// Monday's final call (NEWS_CLOCK.final), a spinning football as the wait symbol, and something to do while you wait:
// throw the challenge flag. You get two challenges like an NFL coach; the ref rules on each (one line from RULINGS,
// never the same twice in a visit), then you're out, the button turns into a bribe and the bribe gets reported. The
// header stays usable above it (z-index under the bar), so the Live tab is one tap away. Under reduced motion the ball
// and the flag hold still.
import { useEffect, useRef, useState } from 'react';
import { NEWS_CLOCK, weekMinute } from '../../lib/newsclock.js';

const RULINGS = [
  'After further review, the ruling on the field stands. The ranks stay locked.',
  'The play is under review. The review will take until Monday night.',
  'Upon further review, there is no indisputable evidence that anyone deserves to move up.',
  'The booth has looked at it from every angle. Still locked. Nice throw though.',
  'Challenge denied. The ranks are in the locker room and they are not coming out.',
  'The ref went under the hood and fell asleep. Ruling stands.',
];
const OUT = 'You are out of challenges. A timeout has been charged to your team.';
const REPORTED = 'Bribery attempt logged and forwarded to the commissioner. Dan will be in touch.';

// minutes until the final call, Monday night (the clock runs in Central minutes from Sunday midnight)
function minutesLeft() {
  const left = NEWS_CLOCK.final - weekMinute(new Date());
  return left > 0 ? left : left + 7 * 1440;
}
const clockOf = (m) => {
  const d = Math.floor(m / 1440), hh = Math.floor((m % 1440) / 60), mm = m % 60;
  return [d ? `${d}d` : '', `${String(hh).padStart(d ? 2 : 1, '0')}h`, `${String(mm).padStart(2, '0')}m`].filter(Boolean).join(' ');
};

export function Lockout({ wk }) {
  const [left, setLeft] = useState(minutesLeft);
  const [thrown, setThrown] = useState(0); // challenges used this visit
  const [ruling, setRuling] = useState('');
  const [flying, setFlying] = useState(0); // a key that restarts the flag's flight
  const order = useRef(null);
  useEffect(() => { const id = setInterval(() => setLeft(minutesLeft()), 15000); return () => clearInterval(id); }, []);
  // the rulings in a shuffled order for this visit, so none repeats
  if (!order.current) order.current = [...RULINGS].sort(() => Math.random() - 0.5);

  const bribe = thrown >= 3;
  const throwFlag = () => {
    if (thrown >= 4) return;
    const n = thrown + 1;
    setThrown(n);
    setFlying((k) => k + 1);
    setRuling(n <= 2 ? order.current[(n - 1) % order.current.length] : n === 3 ? OUT : REPORTED);
  };
  const label = thrown < 2 ? `Throw the challenge flag (${2 - thrown} left)` : thrown === 2 ? 'Throw it anyway' : thrown === 3 ? 'Slip the ref $20' : 'Reported';

  return (
    <div className="lockout" role="dialog" aria-modal="true" aria-labelledby="lo-title">
      <div className="lo-card glass rim">
        <div className="lo-ball" aria-hidden="true"><span /></div>
        <span className="lo-tag">{`Week ${wk} in progress`}</span>
        <h2 id="lo-title">The rankings are locked</h2>
        <p className="lo-sub">The games are live, so the power rankings stay frozen until every game is final. No peeking, no mid-game panic. Follow the action on the Live tab.</p>
        <div className="lo-clock" aria-live="off">
          <small>Final call in about</small>
          <b>{clockOf(left)}</b>
          <small>Monday night, after the last game</small>
        </div>
        <div className="lo-play">
          <button type="button" className={`cta lo-flag-btn${bribe ? ' bribe' : ''}`} onClick={throwFlag} disabled={thrown >= 4}>{label}</button>
          {flying ? <span key={flying} className="lo-flag" aria-hidden="true" /> : null}
          <p className={`lo-ruling${ruling ? ' on' : ''}`} aria-live="polite">{ruling || 'Think the ranks should be unlocked? Challenge the call.'}</p>
        </div>
        <a className="lo-live" href="#live">Take me to the Live tab</a>
      </div>
    </div>
  );
}
