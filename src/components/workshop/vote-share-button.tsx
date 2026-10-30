"use client";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Check, QrCode, Share2 } from "lucide-react";
import { voteShareUrl, type SharedVoteTarget } from "@/lib/workshop/vote-link";

export function VoteShareButton(target: SharedVoteTarget) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState("");
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 3000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    const url = voteShareUrl(location.href, target);
    try {
      await navigator.clipboard.writeText(url);
      setFallback("");
      setCopied(true);
    } catch {
      setCopied(false);
      setFallback(url);
    }
  }

  return <div className="vote-share">
    <button type="button" className="secondary-button" onClick={copy}
      title="이 투표로 바로 이동하는 링크 복사">
      {copied ? <Check size={14} /> : <Share2 size={14} />}
      {copied ? "복사했어요" : "공유하기"}
    </button>
    <span className="sr-only" role="status">{copied ? "투표 링크를 복사했어요. 프로젝트에 참여한 구성원에게 보내주세요." : ""}</span>
    {fallback && <div className="vote-share-fallback">
      <label>아래 링크를 선택해서 복사해주세요.
        <input aria-label="투표 공유 링크" readOnly value={fallback} onFocus={(e) => e.currentTarget.select()} />
      </label>
      <small>프로젝트에 참여한 구성원이 로그인하면 이 투표로 바로 이동해요.</small>
    </div>}
  </div>;
}

// A QR code for the join board, big enough to show on a projector; scanning it opens this board after login.
export function JoinBoardQr(target: SharedVoteTarget & { boardId: string }) {
  const [open, setOpen] = useState(false), [url, setUrl] = useState(""), [copied, setCopied] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { cohortId, projectId, voteId, boardId } = target;
  useEffect(() => {
    if (!open) return;
    const link = voteShareUrl(location.href, { cohortId, projectId, voteId, boardId });
    setUrl(link);
    if (canvas.current) QRCode.toCanvas(canvas.current, link, { width: 240, margin: 2, color: { dark: "#271236", light: "#ffffff" } }).catch(() => {});
  }, [open, cohortId, projectId, voteId, boardId]);
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); }
  }
  return <div className="join-qr">
    <button type="button" className="secondary-button" aria-expanded={open} onClick={() => setOpen(!open)}><QrCode size={14} /> {open ? "QR 코드 닫기" : "QR 코드로 참여"}</button>
    {open && <div className="join-qr-panel">
      <canvas ref={canvas} aria-label="이 참여 화면으로 바로 오는 QR 코드" />
      <div>
        <strong>휴대폰 카메라로 찍으면 바로 이 화면이 열려요</strong>
        <small>로그인한 뒤 들어갈 팀의 "이 팀으로 들어가기"를 누르면 돼요.</small>
        <input aria-label="참여 화면 링크" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
        <button type="button" className="secondary-button" onClick={copy}>{copied ? <><Check size={14} /> 복사했어요</> : "링크 복사"}</button>
      </div>
    </div>}
  </div>;
}
