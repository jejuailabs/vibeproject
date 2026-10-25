"use client";
import { useEffect, useState } from "react";
import { Check, Share2 } from "lucide-react";
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
