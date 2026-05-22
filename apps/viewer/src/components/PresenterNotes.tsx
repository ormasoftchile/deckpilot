interface PresenterNotesProps {
  slideIndex: number;
  total: number;
  title: string;
  notes: string;
  voiceCues: string[];
}

export function PresenterNotes({ slideIndex, total, title, notes, voiceCues }: PresenterNotesProps): JSX.Element {
  return (
    <aside className="dp-notes">
      <header className="dp-notes-header">
        <span className="dp-notes-position">{slideIndex + 1} / {total}</span>
        <strong className="dp-notes-title">{title}</strong>
      </header>
      {notes ? (
        <pre className="dp-notes-body">{notes}</pre>
      ) : (
        <p className="dp-notes-empty">No speaker notes for this slide.</p>
      )}
      {voiceCues.length > 0 && (
        <section className="dp-notes-cues">
          <h3>Voice cues</h3>
          <ol>
            {voiceCues.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ol>
        </section>
      )}
    </aside>
  );
}
