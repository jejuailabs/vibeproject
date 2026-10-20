"use client";
import { useState, useId, type ReactNode } from "react";
import type { Workspace } from "@/lib/types";
import type { CardAsk, CoachAsk, DraftAsk } from "@/lib/coaching";
import type {
  WorkshopRecord,
  Kind,
  RecordOf,
  Snapshot,
} from "@/lib/workshop/model";
export type Props = {
  workspace: Workspace;
  records: WorkshopRecord[];
  run: (command: unknown) => Promise<boolean>;
  busy: boolean;
  preview: boolean;
  ai?: Snapshot["ai"];
  askCoach?: CoachAsk;
  makeCard?: CardAsk;
  makeDraft?: DraftAsk;
  invites?: Snapshot["invites"];
  download?: (id: string) => Promise<void>;
  upload?: (
    file: File,
    scope: string,
    projectId: string | null,
  ) => Promise<void>;
  exportBaseline?: (id: string) => Promise<void>;
};
export function recordsOf<K extends Kind>(p: Props, k: K) {
  return p.records.filter((r) => r.kind === k) as RecordOf<K>[];
}
export type Field = {
  name: string;
  label: string;
  value?: any;
  type?:
    | "text"
    | "area"
    | "number"
    | "check"
    | "select"
    | "multi"
    | "datetime-local"
    | "email"
    | "url";
  options?: { value: string; label: string }[];
  optional?: boolean;
  max?: number;
  min?: number;
  hint?: string;
};
export const choices = (values: string[], labels?: Record<string, string>) =>
  values.map((value) => ({ value, label: labels?.[value] || value }));
export const reason: Field = {
  name: "reason",
  label: "결정·변경 이유",
  value: "",
  max: 500,
};
export const title: Field = { name: "title", label: "제목", max: 160 };
export const body: Field = {
  name: "body",
  label: "내용",
  type: "area",
  max: 20000,
};
export function Box({
  id,
  title,
  eyebrow,
  className = "",
  children,
}: {
  id?: string;
  title: string;
  eyebrow?: string;
  className?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section id={id} className={"wk-box " + className} aria-labelledby={headingId}>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2 id={headingId}>{title}</h2>
      {children}
    </section>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <p className="wk-empty">{children}</p>;
}
export function Badge({ children }: { children: ReactNode }) {
  return <span className="wk-badge">{children}</span>;
}
export function Action({
  id,
  label,
  fields = [],
  command,
  run,
  busy,
  open = false,
  submitLabel = "저장",
  map,
}: {
  id?: string;
  label: string;
  fields?: Field[];
  command: Record<string, unknown>;
  run: Props["run"];
  busy: boolean;
  open?: boolean;
  submitLabel?: string;
  map?: (v: any) => unknown;
}) {
  const formId = useId();
  const [values, setValues] = useState<Record<string, any>>(() =>
    Object.fromEntries(
      fields.map((f) => [
        f.name,
        f.value ?? (f.type === "check" ? false : f.type === "multi" ? [] : ""),
      ]),
    ),
  );
  const [done, setDone] = useState(false);
  const [baseCommand, setBaseCommand] = useState(command);
  const actualCommand = Object.hasOwn(command, "revision")
    ? baseCommand
    : command;
  return (
    <details id={id} className="wk-action" open={open || undefined}>
      <summary>
        {label}
        <span>＋</span>
      </summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const data = { ...actualCommand, ...values };
          for (const f of fields) {
            if (f.type === "number") data[f.name] = Number(data[f.name]);
            if (f.type === "datetime-local" && data[f.name])
              data[f.name] = new Date(data[f.name]).toISOString();
          }
          if (await run(map ? map(data) : data)) {
            setDone(true);
            setBaseCommand({
              ...command,
              ...(typeof data.revision === "number"
                ? { revision: data.revision + 1 }
                : {}),
            });
          }
        }}
      >
        {Object.hasOwn(command, "revision") &&
          command.revision !== baseCommand.revision && (
            <div className="wk-callout">
              새 버전이 있습니다. 입력 내용은 유지했습니다.
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setBaseCommand(command);
                  setValues(
                    Object.fromEntries(
                      fields.map((f) => [
                        f.name,
                        f.value ??
                          (f.type === "check"
                            ? false
                            : f.type === "multi"
                              ? []
                              : ""),
                      ]),
                    ),
                  );
                }}
              >
                최신 내용으로 다시 불러오기
              </button>
            </div>
          )}
        {fields.map((f) => (
          <div
            key={f.name}
            className={"wk-field " + (f.type === "check" ? "wk-check" : "")}
          >
            <label htmlFor={formId + f.name}>{f.label}</label>
            {f.type === "area" ? (
              <textarea
                id={formId + f.name}
                aria-label={f.label}
                rows={5}
                value={values[f.name]}
                onChange={(e) => {
                  setDone(false);
                  setValues({ ...values, [f.name]: e.target.value });
                }}
                required={!f.optional}
                maxLength={f.max || 20000}
              />
            ) : f.type === "select" ? (
              <select
                id={formId + f.name}
                aria-label={f.label}
                value={values[f.name]}
                required={!f.optional}
                onChange={(e) => {
                  setDone(false);
                  setValues({ ...values, [f.name]: e.target.value });
                }}
              >
                <option value="">선택해주세요</option>
                {f.options?.map((o) => (
                  <option value={o.value} key={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.type === "multi" ? (
              <div className="wk-options" role="group" aria-label={f.label}>
                {f.options?.map((o) => (
                  <label key={o.value}>
                    <input
                      type="checkbox"
                      checked={(values[f.name] || []).includes(o.value)}
                      onChange={(e) => {
                        setDone(false);
                        setValues({
                          ...values,
                          [f.name]: e.target.checked
                            ? [...values[f.name], o.value]
                            : values[f.name].filter(
                                (v: string) => v !== o.value,
                              ),
                        });
                      }}
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            ) : (
              <input
                id={formId + f.name}
                aria-label={f.label}
                type={f.type === "check" ? "checkbox" : f.type || "text"}
                {...(f.type === "check"
                  ? { checked: values[f.name] }
                  : { value: values[f.name] })}
                onChange={(e) => {
                  setDone(false);
                  setValues({
                    ...values,
                    [f.name]:
                      f.type === "check" ? e.target.checked : e.target.value,
                  });
                }}
                required={!f.optional && f.type !== "check"}
                maxLength={f.max || 500}
                min={f.min}
                max={f.max}
              />
            )}{" "}
            {f.hint && <small>{f.hint}</small>}
          </div>
        ))}
        <button className="primary-button" disabled={busy}>
          {busy ? "저장 중…" : submitLabel}
        </button>
        {done && (
          <span role="status" className="wk-saved">
            저장되었습니다.
          </span>
        )}
      </form>
    </details>
  );
}
export function inputDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function stamp(v: string) {
  return new Date(v).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
export function link(url: string, label: string) {
  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className="wk-link">
      {label} ↗
    </a>
  ) : null;
}
export function uid(prefix = "item") {
  return prefix + "-" + crypto.randomUUID();
}
export const scopeOptions = choices(["owner", "project", "cohort"], {
  owner: "나만 보기",
  project: "우리 팀",
  cohort: "기수 전체",
});
export function RunButton({
  p,
  command,
  children,
}: {
  p: Props;
  command: unknown;
  children: ReactNode;
}) {
  return (
    <button
      className="secondary-button"
      disabled={p.busy}
      onClick={() => p.run(command)}
    >
      {children}
    </button>
  );
}
