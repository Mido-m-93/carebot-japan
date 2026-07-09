"use client";
import { useEffect, useState } from "react";
import { API_URL, supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";

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

const STATUS_LABEL_KEYS = {
  draft: "claims_status_draft",
  submitted: "claims_status_submitted",
  under_review: "claims_status_under_review",
  approved: "claims_status_approved",
  rejected: "claims_status_rejected",
  resubmit: "claims_status_resubmit",
} as const;

export default function ClaimsPage() {
  const { t, lang } = useLanguage();
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

  const formFields = [
    { key: "patient_name", label: t.claims_field_patient_name },
    { key: "insurer_name", label: t.claims_field_insurer_name },
    { key: "policy_number", label: t.claims_field_policy_number },
    { key: "amount_claimed", label: t.claims_field_amount, type: "number" },
    { key: "procedure_codes", label: t.claims_field_procedure_codes },
    { key: "diagnosis_codes", label: t.claims_field_diagnosis_codes },
  ];

  async function authHeader() {
    const { data: { session } } = await supabase.auth.getSession();
    return session ? { Authorization: `Bearer ${session.access_token}` } : null;
  }

  async function loadClaims() {
    setLoadError(null);
    try {
      const headers = await authHeader();
      if (!headers) { setLoading(false); return; }
      const res = await fetch(`${API_URL}/claims/`, { headers });
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
      const headers = await authHeader();
      if (!headers) { setCreateError("Not signed in"); setCreating(false); return; }
      const res = await fetch(`${API_URL}/claims/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
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
      const headers = await authHeader();
      if (!headers) return;
      const res = await fetch(`${API_URL}/claims/${claimId}/submit`, { method: "POST", headers });
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
    return new Date(iso).toLocaleString(lang === "ja" ? "ja-JP" : "en-US", {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
      timeZone: "Asia/Tokyo",
    });
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t.claims_title}</h1>
          <p className="text-sm text-gray-500 mt-1">{t.claims_subtitle}</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
        >
          {showForm ? t.claims_cancel : t.claims_new}
        </button>
      </div>

      {/* New claim form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-medium text-gray-800 mb-4">{t.claims_new_title}</h2>
          <div className="grid grid-cols-2 gap-4">
            {formFields.map(({ key, label, type }) => (
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
              <label className="block text-xs font-medium text-gray-500 mb-1">{t.claims_field_notes}</label>
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
              <p className="text-xs font-medium text-red-700 mb-1">{t.claims_error_generic}</p>
              <p className="text-xs text-red-500 font-mono">{createError}</p>
              {createError.includes("does not exist") || createError.includes("42P01") ? (
                <p className="text-xs text-red-500 mt-1">{t.claims_error_schema_hint}</p>
              ) : null}
            </div>
          )}
          <div className="flex gap-3 mt-4">
            <button
              onClick={createClaim}
              disabled={creating}
              className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {creating ? t.claims_saving : t.claims_save_draft}
            </button>
          </div>
        </div>
      )}

      {/* Claims list */}
      {loadError && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <p className="text-sm font-medium text-red-700">{t.claims_error_api}</p>
          <p className="text-xs text-red-500 mt-1 font-mono">{loadError}</p>
          <p className="text-xs text-red-500 mt-2">{t.claims_error_schema_hint2}</p>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">{t.loading}</p>
      ) : claims.length === 0 && !loadError ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">{t.claims_empty}</p>
          <p className="text-xs text-gray-300 mt-1">{t.claims_empty_sub}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {claims.map((claim) => {
            const review = aiReview[claim.id] ?? (claim.ai_flags as unknown as AIReview | null);
            const flagCount = review?.flags?.length ?? 0;
            const statusKey = STATUS_LABEL_KEYS[claim.status as keyof typeof STATUS_LABEL_KEYS];

            return (
              <div key={claim.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[claim.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {statusKey ? t[statusKey] : claim.status}
                      </span>
                      {flagCount > 0 && (
                        <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                          {t.claims_ai_warning(flagCount)}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-400">{t.claims_col_patient}</p>
                        <p className="text-gray-800 font-medium">{claim.patient_name ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">{t.claims_col_insurer}</p>
                        <p className="text-gray-800">{claim.insurer_name ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">{t.claims_col_amount}</p>
                        <p className="text-gray-800">{formatYen(claim.amount_claimed)}</p>
                      </div>
                    </div>

                    {/* AI review flags */}
                    {review?.flags && review.flags.length > 0 && (
                      <div className="mt-3 bg-amber-50 rounded-lg p-3">
                        <p className="text-xs font-medium text-amber-700 mb-1">{t.claims_ai_review_title}</p>
                        {review.flags.map((f, i) => (
                          <p key={i} className="text-xs text-amber-600">• {f}</p>
                        ))}
                        {review.notes && (
                          <p className="text-xs text-amber-600 mt-1 italic">{review.notes}</p>
                        )}
                        {review.estimated_approval_rate !== undefined && (
                          <p className="text-xs text-amber-700 mt-1 font-medium">
                            {t.claims_approval_rate(Math.round(review.estimated_approval_rate * 100))}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-400 mb-1">{formatDate(claim.created_at)}</p>
                    {claim.submitted_at && (
                      <p className="text-xs text-gray-400">{t.claims_submitted_label}: {formatDate(claim.submitted_at)}</p>
                    )}
                    {claim.amount_approved !== null && (
                      <p className="text-xs text-teal-600 font-medium mt-1">
                        {t.claims_approved_label}: {formatYen(claim.amount_approved)}
                      </p>
                    )}
                    {claim.status === "draft" && (
                      <button
                        onClick={() => submitClaim(claim.id)}
                        disabled={submitting === claim.id}
                        className="mt-2 px-3 py-1.5 text-xs bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors font-medium"
                      >
                        {submitting === claim.id ? t.claims_submitting : t.claims_submit_ai}
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
