import { HUSK_VERSION, LICENCE, REPO_URL, WEB_URL } from '@/lib/site';

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <span>Husk {HUSK_VERSION}</span>
        <span>{LICENCE}</span>
        <a href={WEB_URL}>Husk home</a>
        <a href={REPO_URL} rel="noreferrer noopener" target="_blank">
          Source
        </a>
        <span>
          These docs are static files. They load no third-party script, no analytics, and no
          fonts from anyone else&rsquo;s server.
        </span>
      </div>
    </footer>
  );
}
