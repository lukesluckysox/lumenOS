export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer__row">
          <span className="footer__brand">
            <svg className="lumen-loop-inline" width="18" height="18" viewBox="0 0 64 64" fill="none" aria-hidden="true">
              <path d="M32 4C47.46 4 60 16.54 60 32S47.46 60 32 60" stroke="var(--gold)" strokeWidth="1.6" strokeLinecap="round" opacity=".6"/>
              <path d="M32 60C16.54 60 4 47.46 4 32S16.54 4 32 4" stroke="var(--gold)" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="4 3" opacity=".25"/>
              <circle cx="32" cy="4" r="2.5" fill="var(--gold)" opacity=".8"/>
              <circle cx="32" cy="32" r="5" fill="var(--gold)" opacity=".5"/>
              <circle cx="32" cy="32" r="3" fill="var(--gold)" opacity=".8"/>
              <circle cx="32" cy="32" r="1.5" fill="var(--gold)"/>
            </svg>
            Lumen
          </span>
          <span className="footer__tag">An operating system for the examined life.</span>
        </div>
      </div>
    </footer>
  );
}
