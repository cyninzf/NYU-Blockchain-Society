/** "You're checked in. Welcome." with their block snapping onto a small chain. */
export default function CheckinDone({ n, note }: { n: number | null; note?: string }) {
  return (
    <div className="ci-done" role="status">
      <div className="ci-chain" aria-hidden="true"><i></i><i></i><i className="new"></i></div>
      <h2 tabIndex={-1}>You&apos;re checked in. Welcome.</h2>
      <p>{n ? <>Block #{n} is on the chain tonight.</> : <>Your block is on the chain tonight.</>}</p>
      {note && <p className="ci-note">{note}</p>}
    </div>
  );
}
