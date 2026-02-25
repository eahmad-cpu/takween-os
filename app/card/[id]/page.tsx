/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { AddBlockInline } from "@/components/add-block-inline";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";

type NodeRow = {
  id: string;
  title: string;
  orderKey: string;
  type: string;
  parentId: string | null;
  blockType?: string;
};

export default function CardPage() {
  const { id } = useParams<{ id: string }>();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [cardTitle, setCardTitle] = useState("");
  const [blocks, setBlocks] = useState<NodeRow[]>([]);

  const loadBlocks = useCallback(
    async (tid: string) => {
      const nodesRef = collection(db, "tenants", tid, "nodes");
      const qBlocks = query(
        nodesRef,
        where("parentId", "==", id),
        where("type", "==", "block"),
        where("archived", "==", false),
        orderBy("orderKey"),
      );

      const blkSnap = await getDocs(qBlocks);
      setBlocks(blkSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    },
    [id],
  );

  useEffect(() => {
    return auth.onAuthStateChanged(async (u) => {
      if (!u) {
        setTenantId(null);
        setCardTitle("");
        setBlocks([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const tid = u.uid;
      setTenantId(tid);

      const cardRef = doc(db, "tenants", tid, "nodes", id);
      const cardSnap = await getDoc(cardRef);

      setCardTitle(
        cardSnap.exists()
          ? ((cardSnap.data() as any).title as string)
          : "كارت غير موجود",
      );
      await loadBlocks(tid);

      setLoading(false);
    });
  }, [id, loadBlocks]);

  if (!tenantId)
    return (
      <div className="text-muted-foreground">سجّل الدخول لعرض بياناتك.</div>
    );
  if (loading)
    return <div className="text-muted-foreground">جارٍ التحميل...</div>;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{cardTitle}</h1>

        <AddBlockInline
          tenantId={tenantId}
          parentId={id}
          onCreated={() => loadBlocks(tenantId)}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {blocks.map((b) => (
          <Link
            key={b.id}
            href={`/block/${b.id}`}
            className="block rounded-lg border bg-card px-4 py-3 hover:bg-muted"
          >
            <div className="font-bold">{b.title}</div>
            <div className="text-xs text-muted-foreground">
              {b.blockType ?? "block"}
            </div>
          </Link>
        ))}

        {blocks.length === 0 && (
          <div className="text-muted-foreground">لا يوجد Blocks بعد.</div>
        )}
      </div>
    </div>
  );
}
