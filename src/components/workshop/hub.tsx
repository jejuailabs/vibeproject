"use client";
import { useState, useEffect } from "react";
import { Activities } from "./activities";
import { Votes } from "./votes";
import { Studio } from "./studio";
import { Sources } from "./sources";
import { Showcase } from "./showcase";
import { Admin, Inbox } from "./admin";
import type {DocKey} from "@/lib/workshop/model";
import { recordsOf, type Props } from "./common";
import { Communication } from "./communication";
const tabs = [
  ["activities", "현장 활동", "01"],
  ["votes", "투표·팀 구성", "02"],
  ["studio", "기획·개발", "03"],
  ["sources", "자료·녹취록", "04"],
  ["communication", "대화·아이디어", "05"],
  ["showcase", "발표·피드백", "06"],
  ["inbox", "알림·도움", "07"],
  ["admin", "기수 운영", "08"],
] as const;
export function WorkshopHub(p: Props & { requestedTab?: { id: string; revision: number; docKey?: DocKey; target?: string } }) {
  const [tab, setTab] = useState("activities");
  useEffect(() => {
    const t = new URLSearchParams(location.search).get("tab");
    if (t && tabs.some((v) => v[0] === t)) setTab(t);
  }, []);
  useEffect(() => {
    const item = new URLSearchParams(location.search).get("item");
    if (item) {
      const t = setTimeout(
        () =>
          document.getElementById(item)?.scrollIntoView({ block: "center" }),
        150,
      );
      return () => clearTimeout(t);
    }
  }, [p.records, tab]);
  useEffect(() => {
    if (!p.requestedTab) return;
    setTab(p.requestedTab.id);
    const u = new URL(location.href);
    u.searchParams.set("view", "workshop");
    u.searchParams.set("tab", p.requestedTab.id);
    u.searchParams.delete("item");
    history.replaceState(null, "", u);
  }, [p.requestedTab]);
  useEffect(() => {
    if (!p.requestedTab?.target || tab !== p.requestedTab.id) return;
    const target = p.requestedTab.target;
    const frame = requestAnimationFrame(() => {
      const element = document.getElementById(target);
      if (element instanceof HTMLDetailsElement) element.open = true;
      element?.scrollIntoView({ block: "start" });
      element?.querySelector<HTMLElement>("input, textarea, select")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [p.requestedTab, tab]);
  const notice = recordsOf(p, "settings")[0]?.data.notice;
  return (
    <div className="workshop-hub" data-screen={tab}>
      {notice && <p className="wk-announcement">{notice}</p>}
      <nav className="wk-tabs" aria-label="워크숍 기능">
        {tabs
          .filter(
            (t) => t[0] !== "admin" || p.workspace.me.role !== "participant",
          )
          .map(([id, label, num]) => (
            <button
              key={id}
              aria-current={tab === id ? "page" : undefined}
              className={tab === id ? "active" : ""}
              onClick={() => {
                setTab(id);
                const u = new URL(location.href);
                u.searchParams.set("view", "workshop");
                u.searchParams.set("tab", id);
                u.searchParams.delete("item");
                history.replaceState(null, "", u);
              }}
            >
              <small>{num}</small>
              {label}
              {id === "inbox" &&
                recordsOf(p, "notification").some((n) => !n.data.read) && <i />}
            </button>
          ))}
      </nav>
      <div className="wk-screen-content">
      {tab === "activities" && <Activities {...p} />}
      {tab === "votes" && <Votes {...p} />}
      {tab === "studio" && <Studio {...p} requestedDocKey={p.requestedTab?.docKey} />}
      {tab === "sources" && <Sources {...p} />}
      {tab === "communication" && <Communication {...p} />}
      {tab === "showcase" && <Showcase {...p} />}
      {tab === "inbox" && <Inbox {...p} />}
      {tab === "admin" && <Admin {...p} />}
      </div>
    </div>
  );
}
