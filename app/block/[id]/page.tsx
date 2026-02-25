/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { ChecklistBlock } from "@/components/blocks/checklist-block";
import { PlaylistBlock } from "@/components/blocks/playlist-block";

import { renameNodeTitle } from "@/lib/node-actions";

export default function BlockPage() {
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [blockType, setBlockType] = useState<string>("");

  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");

  useEffect(() => {
    return auth.onAuthStateChanged(async (u) => {
      if (!u) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const tenantId = u.uid;

      const ref = doc(db, "tenants", tenantId, "nodes", id);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        setTitle("Block غير موجود");
        setBlockType("");
        setLoading(false);
        return;
      }

      const data = snap.data() as any;
      setTitle(data.title ?? "");
      setDraftTitle((prev) => (prev ? prev : (data.title ?? "")));
      setBlockType(data.blockType ?? "");
      setLoading(false);
    });
  }, [id]);

  if (!auth.currentUser)
    return <div className="text-muted-foreground">سجّل الدخول.</div>;
  if (loading)
    return <div className="text-muted-foreground">جارٍ التحميل...</div>;

  const tenantId = auth.currentUser.uid;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between gap-2">
          {!editing ? (
            <h1 className="text-2xl font-bold">{title}</h1>
          ) : (
            <input
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
            />
          )}

          <div className="flex items-center gap-2">
            {!editing ? (
              <button
                className="rounded-md border px-3 py-2 text-sm"
                onClick={() => setEditing(true)}
              >
                تعديل الاسم
              </button>
            ) : (
              <>
                <button
                  className="rounded-md border px-3 py-2 text-sm"
                  onClick={async () => {
                    await renameNodeTitle({
                      tenantId,
                      nodeId: id,
                      title: draftTitle,
                    });
                    setEditing(false);
                  }}
                >
                  حفظ
                </button>
                <button
                  className="rounded-md border px-3 py-2 text-sm"
                  onClick={() => {
                    setDraftTitle(title);
                    setEditing(false);
                  }}
                >
                  إلغاء
                </button>
              </>
            )}
          </div>
        </div>
        <p className="text-muted-foreground">{blockType || "block"}</p>
      </div>

      {blockType === "playlist" ? (
        <PlaylistBlock tenantId={tenantId} blockId={id} />
      ) : blockType === "checklist" ? (
        <ChecklistBlock tenantId={tenantId} blockId={id} />
      ) : (
        <div className="text-muted-foreground">
          Renderer غير جاهز لهذا النوع بعد.
        </div>
      )}
    </div>
  );
}
