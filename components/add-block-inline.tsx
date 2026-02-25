"use client";

import { useState } from "react";
import { createBlock } from "@/lib/create-block";

type BlockType =
  | "checklist"
  | "counter"
  | "playlist"
  | "roadmap"
  | "project"
  | "notes";

const LABELS: Record<BlockType, string> = {
  checklist: "Checklist",
  counter: "عداد",
  playlist: "قائمة تشغيل",
  roadmap: "خارطة طريق",
  project: "مشروع",
  notes: "ملاحظات",
};

export function AddBlockInline({
  tenantId,
  parentId,
  onCreated,
}: {
  tenantId: string;
  parentId: string;
  onCreated?: () => void;
}) {
  const [type, setType] = useState<BlockType>("checklist");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    await createBlock({
      tenantId,
      parentId,
      blockType: type,
      title: title.trim() || `(${LABELS[type]}) جديد`,
    });
    setTitle("");
    setBusy(false);
    onCreated?.();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <select
        className="h-9 rounded-md border bg-background px-2 text-sm"
        value={type}
        onChange={(e) => setType(e.target.value as BlockType)}
      >
        {Object.entries(LABELS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>

      <input
        className="h-9 w-64 rounded-md border bg-background px-3 text-sm"
        placeholder="عنوان البلوك (اختياري)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <button
        className="h-9 rounded-md border px-3 text-sm"
        onClick={create}
        disabled={busy}
      >
        {busy ? "جارٍ الإضافة..." : "إضافة Block"}
      </button>
    </div>
  );
}
