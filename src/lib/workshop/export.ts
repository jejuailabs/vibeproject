import { zipSync, strToU8 } from "fflate";
import { docKeys, type RecordOf } from "./model";
export async function baselineArchive(
  baseline: RecordOf<"baseline">,
  versions: RecordOf<"version">[],
  name: string,
) {
  const files: Record<string, string> = {};
  for (const key of docKeys) {
    const ref = baseline.data.versions.find((v) => v.key === key),
      version = versions.find(
        (v) =>
          v.id === ref?.id &&
          v.projectId === baseline.projectId &&
          v.data.key === key &&
          v.data.documentRevision === ref?.revision,
      );
    if (version?.data.redacted)
      throw new Error(
        "원문 정정으로 이 확정본의 내보내기가 중지되었습니다. 새 기준 버전을 확정해주세요.",
      );
    if (!version) throw new Error("확정 문서 버전이 누락되었습니다.");
    files["docs/" + key + ".md"] = version.data.markdown;
  }
  files["main.md"] =
    "# " +
    name +
    "\n\n## 개발 기준\n- 기준: " +
    baseline.data.title +
    "\n- 식별자: " +
    baseline.id +
    "\n- 확정: " +
    baseline.createdAt +
    "\n\n## 필수 문서\n" +
    docKeys.map((k) => "- [docs/" + k + ".md](docs/" + k + ".md)").join("\n") +
    "\n\n위 문서를 읽고 완료 기준에 맞춰 구현하세요. 비밀키는 저장소에 기록하지 않고 서버 환경변수로 관리합니다.\n";
  const manifest: { path: string; sha256: string }[] = [];
  for (const [path, text] of Object.entries(files)) {
    const hash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(text),
    );
    manifest.push({
      path,
      sha256: Array.from(new Uint8Array(hash), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join(""),
    });
  }
  files["manifest.json"] = JSON.stringify(
    { baselineId: baseline.id, createdAt: baseline.createdAt, files: manifest },
    null,
    2,
  );
  const zipped = zipSync(
    Object.fromEntries(
      Object.entries(files).map(([p, s]) => [
        p,
        [strToU8(s), { mtime: new Date("2000-01-01T00:00:00Z") }],
      ]),
    ),
    { level: 6 },
  );
  return { bytes: zipped, files };
}
