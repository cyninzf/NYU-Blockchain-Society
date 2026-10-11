/** The error for one field, right below it (round 21). Linked from the field by aria-describedby. */
export default function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p className="field-err" id={id}>{message}</p>;
}
