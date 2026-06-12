"use client";
import { useEffect, useState } from "react";
import { API_URL, DEMO_CLINIC_ID } from "@/lib/supabase";

interface Claim {
  id: string;
  patient_name: string | null;
  insurer_name: string | null;
  amount_claimed: number | null;
  amount_approved: number | null;
  status: string;
  ai_flags: Record<string, unknown> | null;
  submitted_at: string | null;
  created_at: string;
}

interface AIReview {
  is_valid: boolean;
  confidence: number;
  flags: string[];
  suggested_procedure_codes: string[];
  estimated_approval_rate: number;
  notes: string;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  submitted: "bg-blue-50 text-blue-700",
  under_review: "bg-amber-50 text-amber-700",
  approved: "bg-teal-50 text-teal-700",
  rejected: "bg-red-50 text-red-600",
  resubmit: "bg-orange-50 text-orange-700",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "下書き",
  submitted: "申請済",
  under_review: "審査中",
  approved: "承認",
  rejected: "却下",
  resubmit: "再申請",
};

export default function ClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [aiReview, setAiReview] = useState<Record<string, AIReview>>({});

  // New claim form state
  const [form, setForm] = useState({
    patient_name: "",
    insurer_name: "",
    policy_number: "",
    procedure_codes: "",
    diagnosis_codes: "",
    amount_claimed: "",
    notes: "",
  });
  const [creating, setCreating] = useState(false);

  async function loadClaims() {
    setLoadError(null);
    try {
      const res = await fetch(`${API_URL}/claims/${DEMO_CLINIC_ID}`);
      if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
      const data = await res.json();
      setClaims(Array.isArray(data) ? data : []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load claims");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadClaims(); }, []);

  async function createClaim() {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch(`${API_URL}/claims/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinic_id: DEMO_CLINIC_ID,
          patient_name: form.patient_name || null,
          insurer_name: form.insurer_name || null,
          policy_number: form.policy_number || null,
          procedure_codes: form.procedure_codes.split(",").map(s => s.trim()).filter(Boolean),
          diagnosis_codes: form.diagnosis_codes.split(",").map(s => s.trim()).filter(Boolean),
          amount_claimed: form.amount_claimed ? parseInt(form.amount_claimed) : null,
          notes: form.notes || null,
        }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
      setForm({ patient_name: "", insurer_name: "", policy_number: "", procedure_codes: "", diagnosis_codes: "", amount_claimed: "", notes: "" });
      setShowForm(false);
      await loadClaims();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create claim");
    } finally {
      setCreating(false);
    }
  }

  async function submitClaim(claimId: string) {
    setSubmitting(claimId);
    try {
      const res = await fetch(`${API_URL}/claims/${claimId}/submit`, { method: "POST" });
      const data = await res.json();
      if (data.ai_review) {
        setAiReview(prev => ({ ...prev, [claimId]: data.ai_review }));
      }
      await loadClaims();
    } finally {
      setSubmitting(null);
    }
  }

  function formatYen(amount: number | null) {
    if (amount === null) return "—";
    return `¥${amount.toLocaleString("ja-JP")}`;
  }

  function formatDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("ja-JP", {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
      timeZone: "Asia/Tokyo",
    });
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">保険請求</h1>
          <p className="text-sm text-gray-500 mt-1">Claims Management — AI-assisted insurance workflow</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
        >
          {showForm ? "キャンセル" : "+ 新規請求"}
        </button>
      </div>

      {/* New claim form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-medium text-gray-800 mb-4">新規保険請求</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: "patient_name", label: "患者名" },
              { key: "insurer_name", label: "保険者名" },
              { key: "policy_number", label: "保険証番号" },
              { key: "amount_claimed", label: "請求金額（円）", type: "number" },
              { key: "procedure_codes", label: "診療行為コード（カンマ区切り）" },
              { key: "diagnosis_codes", label: "傷病名コード（カンマ区切り）" },
            ].map(({ key, label, type }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                <input
                  type={type ?? "text"}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-teal-400"
                />
              </div>
            ))}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">備考</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-teal-400 resize-none"
              />
            </div>
          </div>
          {createError && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-xs font-medium text-red-700 mb-1">エラーが発生しました</p>
              <p className="text-xs text-red-500 font-mono">{createError}</p>
              {createError.includes("does not exist") || createError.includes("42P01") ? (
                <p className="text-xs text-red-500 mt-1">
                  SupabaseでSchema_additions.sqlを実行してください。
                </p>
              ) : null}
            </div>
          )}
          <div className="flex gap-3 mt-4">
            <button
              onClick={createClaim}
              disabled={creating}
              className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {creating ? "保存中..." : "下書きとして保存"}
            </button>
          </div>
        </div>
      )}

      {/* Claims list */}
      {loadError && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <p className="text-sm font-medium text-red-700">APIエラー — テーブルが存在しない可能性があります</p>
          <p className="text-xs text-red-500 mt-1 font-mono">{loadError}</p>
          <p className="text-xs text-red-500 mt-2">
            Supabase SQL Editorで <strong>schema_additions.sql</strong> を実行してください。
          </p>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">読み込み中...</p>
      ) : claims.length === 0 && !loadError ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">請求がありません</p>
          <p className="text-xs text-gray-300 mt-1">「+ 新規請求」から作成してください</p>
        </div>
      ) : (
        <div className="space-y-3">
          {claims.map((claim) => {
            const review = aiReview[claim.id] ?? (claim.ai_flags as AIReview | null);
            const flagCount = review?.flags?.length ?? 0;

            return (
              <div key={claim.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[claim.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABELS[claim.status] ?? claim.status}
                      </span>
                      {flagCount > 0 && (
                        <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                          ⚠ AI警告 {flagCount}件
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-400">患者名</p>
                        <p className="text-gray-800 font-medium">{claim.patient_name ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">保険者</p>
                        <p className="text-gray-800">{claim.insurer_name ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">請求額</p>
                        <p className="text-gray-800">{formatYen(claim.amount_claimed)}</p>
                      </div>
                    </div>

                    {/* AI review flags */}
                    {review?.flags && review.flags.length > 0 && (
                      <div className="mt-3 bg-amber-50 rounded-lg p-3">
                        <p className="text-xs font-medium text-amber-700 mb-1">AI審査結果</p>
                        {review.flags.map((f, i) => (
                          <p key={i} className="text-xs text-amber-600">• {f}</p>
                        ))}
                        {review.notes && (
                          <p className="text-xs text-amber-600 mt-1 italic">{review.notes}</p>
                        )}
                        {review.estimated_approval_rate !== undefined && (
                          <p className="text-xs text-amber-700 mt-1 font-medium">
                            承認予測率: {Math.round(review.estimated_approval_rate * 100)}%
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-400 mb-1">{formatDate(claim.created_at)}</p>
                    {claim.submitted_at && (
                      <p className="text-xs text-gray-400">申請: {formatDate(claim.submitted_at)}</p>
                    )}
                    {claim.amount_approved !== null && (
                      <p className="text-xs text-teal-600 font-medium mt-1">
                        承認額: {formatYen(claim.amount_approved)}
                      </p>
                    )}
                    {claim.status === "draft" && (
                      <button
                        onClick={() => submitClaim(claim.id)}
                        disabled={submitting === claim.id}
                        className="mt-2 px-3 py-1.5 text-xs bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors font-medium"
                      >
                        {submitting === claim.id ? "申請中..." : "AI審査して申請"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
