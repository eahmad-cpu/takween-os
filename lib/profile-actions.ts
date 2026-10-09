import { db } from "@/lib/firebase";
import { collection, doc, increment, setDoc, updateDoc } from "firebase/firestore";

export type AspectsCurrentReview = {
  updatedAt: number;
  averageScore: number | null;
  items: Record<
    string,
    {
      aspectId: string;
      title: string;
      score: number | null;
      currentState: string;
      challenge: string;
      nextStep: string;
      updatedAt: number;
    }
  >;
};

export async function saveBirthDate(uid: string, birthDateISO: string) {
  // birthDateISO: YYYY-MM-DD
  await setDoc(
    doc(db, "users", uid),
    {
      birthDate: birthDateISO,
      updatedAt: Date.now(),
      version: increment(1),
    },
    { merge: true }
  );
}

export async function saveCompass(uid: string, compass: { mission: string; vision: string; values: string }) {
  await updateDoc(doc(db, "users", uid), {
    compass,
    updatedAt: Date.now(),
    version: increment(1),
  });
}

export async function saveFocusCurrent(
  uid: string,
  focus: { title: string; description: string; priorities: Array<{ id: string; label: string }> }
) {
  await updateDoc(doc(db, "users", uid), {
    focusCurrent: focus,
    updatedAt: Date.now(),
    version: increment(1),
  });
}

export async function clearFocusCurrent(uid: string) {
  await updateDoc(doc(db, "users", uid), {
    focusCurrent: null,
    updatedAt: Date.now(),
    version: increment(1),
  });
}

export async function saveAspectsCurrentReview(
  uid: string,
  review: AspectsCurrentReview,
) {
  await setDoc(
    doc(db, "users", uid),
    {
      aspectsCurrentReview: review,
      updatedAt: review.updatedAt,
      version: increment(1),
    },
    { merge: true },
  );
}

export type AspectsReviewHistory = {
  parentId: "aspect_reviews";
  type: "aspect_review";
  title: string;
  reviewKind: "aspects_current_assessment";
  reviewDateKey: string;
  reviewDateLabel: string;
  averageScore: number | null;
  strongCount: number;
  weakCount: number;
  needsImprovementCount: number;
  ratedCount: number;
  totalCount: number;
  items: AspectsCurrentReview["items"];
  createdAt: number;
  updatedAt: number;
  orderKey: string;
  archived: false;
  version: 1;
};

export async function saveAspectsReviewHistory(
  uid: string,
  assessment: AspectsReviewHistory,
) {
  const assessmentRef = doc(collection(db, "tenants", uid, "nodes"));

  await setDoc(assessmentRef, {
    id: assessmentRef.id,
    tenantId: uid,
    ...assessment,
  });

  return assessmentRef.id;
}
