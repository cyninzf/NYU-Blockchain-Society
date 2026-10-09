"use client";

import { useActionState } from "react";
import { addAdmin, type TeamResult } from "./actions";
import styles from "../admin.module.css";

export default function AddAdmin() {
  const [state, action, pending] = useActionState<TeamResult, FormData>(addAdmin, null);
  return (
    <form className={styles.filters} action={action}>
      <label>Email<input name="email" type="email" required autoComplete="off" /></label>
      <label>Role
        <select name="role" defaultValue="admin">
          <option value="admin">Admin</option>
          <option value="super_admin">Super admin</option>
        </select>
      </label>
      <button type="submit" disabled={pending}>{pending ? "Adding…" : "Add admin"}</button>
      <p className={state?.ok === false ? styles.err : styles.note} role="status">{state ? (state.ok ? state.message : state.error) : ""}</p>
    </form>
  );
}
