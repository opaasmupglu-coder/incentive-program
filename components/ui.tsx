import type { ReactNode } from "react";

/** Page header: kicker + display heading + one plain sentence. */
export function PageHead({
  kicker,
  title,
  description,
  right,
}: {
  kicker: string;
  title: string;
  description: string;
  right?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <p className="kicker">{kicker}</p>
        <h2>{title}</h2>
        <p className="lede">{description}</p>
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}

/** Numbered section head with a hairline rule. */
export function SectionHead({
  num,
  title,
  note,
}: {
  num: string;
  title: string;
  note?: string;
}) {
  return (
    <div className="section-head">
      <span className="sec-num" aria-hidden="true">
        {num}
      </span>
      <h3>{title}</h3>
      {note && <p>{note}</p>}
    </div>
  );
}

/** Loading state, in the same system as everything else. */
export function LoadingState({ what = "Loading the latest numbers" }: { what?: string }) {
  return (
    <div className="state-block" role="status">
      <p className="kicker">Please wait</p>
      <p>{what}…</p>
    </div>
  );
}

/** Error state. */
export function ErrorState({ error }: { error: string }) {
  return (
    <div className="notice error" role="alert">
      <span className="notice-kicker">Error</span>
      {error}
    </div>
  );
}

/** Not-connected state. Lists the missing env vars when the snapshot names them. */
export function NotConnected({ missingEnv }: { missingEnv?: string[] }) {
  return (
    <div className="notice" role="status">
      <span className="notice-kicker">Not connected</span>
      <b>Not connected to the database yet.</b>
      <p>
        Add these environment variables in Vercel (Project → Settings → Environment Variables), then redeploy:
      </p>
      {missingEnv && missingEnv.length > 0 && (
        <ul>
          {missingEnv.map((m) => (
            <li key={m}>
              <code>{m}</code>
            </li>
          ))}
        </ul>
      )}
      <p>
        <code>TURSO_DATABASE_URL</code> is the Turso database URL and <code>TURSO_AUTH_TOKEN</code> is its auth
        token.
      </p>
    </div>
  );
}
