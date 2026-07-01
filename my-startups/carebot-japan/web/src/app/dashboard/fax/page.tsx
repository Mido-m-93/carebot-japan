"use client";
import { useEffect, useState } from "react";
import { API_URL, DEMO_CLINIC_ID } from "@/lib/supabase";

interface Document {
  id: string;
  source: string;
  document_type: string | null;
  status: string;
  patient_name: string | null;
  summary: string | null;
  sender_fax: string | null;
  pages: number;
  flags: string[];
  created_at: string;
}

interface TestResult {
  status: string;
  document_type: string | null;
  patient_name: string | null;
  summary: string | null;
  confidence: number;
  flags: string[];
  extracted: Record<string, unknown>;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  referral: "紹介状",
  prescription: "処方箋",
  insurance_form: "保険証",
  lab_result: "検査結果",
  appointment_request: "予約依頼",
  other: "その他",
};

const DOC_TYPE_COLORS: Record<string, string> = {
  referral: "bg-purple-50 text-purple-700",
  prescription: "bg-blue-50 text-blue-700",
  insurance_form: "bg-teal-50 text-teal-700",
  lab_result: "bg-amber-50 text-amber-700",
  appointment_request: "bg-green-50 text-green-700",
  other: "bg-gray-100 text-gray-600",
};

const EXAMPLE_FAXES = [
  {
    label: "紹介状",
    text: `紹介状\n\n患者氏名：田中花子　生年月日：1975年3月15日\n\n上記患者を貴院にご紹介申し上げます。\n主訴：胸痛、息切れ\n既往歴：高血圧（10年）、2型糖尿病（5年）\n\n心電図にて不整脈が認められましたため、精査をお願い申し上げます。\n\n令和6年4月17日\n東京中央クリニック　山田医師`,
  },
  {
    label: "保険証",
    text: `健康保険被保険者証\n\n記号：東京123　番号：456789\n氏名：鈴木太郎\n生年月日：昭和55年6月20日\n資格取得日：令和2年4月1日\n保険者名：全国健康保険協会東京支部\n有効期限：令和8年3月31日`,
  },
  {
    label: "予約依頼FAX",
    text: `予約依頼\n\n患者名：佐藤一郎　電話：03-1234-5678\n希望日時：来週月曜日の午前中\n来院理由：腰痛（再診）\n\n担当医指名：なし\nよろしくお願いします。`,
  },
];

export default function FaxInboxPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [testText, setTestText] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  async function loadDocs() {
    setLoadError(null);
    try {
      const res = await fetch(`${API_URL}/fax/${DEMO_CLINIC_ID}`);
      if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
      const data = await res.json();
      setDocuments(Array.isArray(data) ? data : []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDocs(); }, []);

  async function sendTestFax() {
    if (!testText.trim()) return;
    setTestLoading(true);
    setTestResult(null);
    setTestError(null);

    try {
      const res = await fetch(`${API_URL}/fax/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinic_id: DEMO_CLINIC_ID, text: testText }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      setTestResult(data);
      await loadDocs();
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setTestLoading(false);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("ja-JP", {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
      timeZone: "Asia/Tokyo",
    });
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">FAX受信ボックス</h1>
        <p className="text-sm text-gray-500 mt-1">Fax Inbox — AI-powered document extraction</p>
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Left: document list */}
        <div className="col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-700">受信済みドキュメント</h2>
            <span className="text-xs text-gray-400">{documents.length}件</span>
          </div>

          {loadError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-xs font-medium text-red-700">APIエラー</p>
              <p className="text-xs text-red-500 font-mono mt-1">{loadError}</p>
              <p className="text-xs text-red-500 mt-1">Supabaseで schema_additions.sql を実行してください。</p>
            </div>
          )}

          {loading ? (
            <p className="text-sm text-gray-400">読み込み中...</p>
          ) : documents.length === 0 && !loadError ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
              <p className="text-sm text-gray-400">FAXがありません</p>
              <p className="text-xs text-gray-300 mt-1">右のフォームからテストFAXを送信してください</p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div key={doc.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          DOC_TYPE_COLORS[doc.document_type ?? "other"] ?? "bg-gray-100 text-gray-600"
                        }`}>
                          {DOC_TYPE_LABELS[doc.document_type ?? "other"] ?? doc.document_type}
                        </span>
                        {doc.flags.length > 0 && (
                          <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
                            ⚠ {doc.flags.length}件の警告
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-800">
                        {doc.patient_name ?? <span className="text-gray-400">患者名不明</span>}
                      </p>
                      {doc.summary && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{doc.summary}</p>
                      )}
                      {doc.flags.length > 0 && (
                        <div className="mt-2 space-y-0.5">
                          {doc.flags.map((f, i) => (
                            <p key={i} className="text-xs text-red-500">• {f}</p>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-400">{formatDate(doc.created_at)}</p>
                      {doc.sender_fax && (
                        <p className="text-xs text-gray-400 mt-0.5">送信元: {doc.sender_fax}</p>
                      )}
                      <p className="text-xs text-gray-400">{doc.pages}ページ</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: test fax sender */}
        <div className="col-span-2">
          <h2 className="text-sm font-medium text-gray-700 mb-3">テストFAX送信</h2>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex flex-wrap gap-2 mb-4">
              {EXAMPLE_FAXES.map((ex) => (
                <button
                  key={ex.label}
                  onClick={() => setTestText(ex.text)}
                  className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {ex.label}
                </button>
              ))}
            </div>

            <textarea
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              rows={8}
              placeholder="FAX内容を入力してください..."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-teal-400 resize-none mb-3"
            />

            <button
              onClick={sendTestFax}
              disabled={testLoading || !testText.trim()}
              className="w-full py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-40 transition-colors"
            >
              {testLoading ? "AI処理中..." : "FAXを送信して解析"}
            </button>

            {testError && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs text-red-600">{testError}</p>
              </div>
            )}

            {testResult && (
              <div className="mt-4 bg-teal-50 border border-teal-200 rounded-lg p-4">
                <p className="text-xs font-medium text-teal-700 mb-2">解析完了</p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex gap-2">
                    <span className="text-gray-400 w-20">種類</span>
                    <span className="text-gray-800">{DOC_TYPE_LABELS[testResult.document_type ?? "other"] ?? "—"}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-gray-400 w-20">患者名</span>
                    <span className="text-gray-800">{testResult.patient_name ?? "—"}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-gray-400 w-20">信頼度</span>
                    <span className="text-gray-800">{Math.round((testResult.confidence ?? 0) * 100)}%</span>
                  </div>
                  {testResult.summary && (
                    <div className="flex gap-2">
                      <span className="text-gray-400 w-20">要約</span>
                      <span className="text-gray-800">{testResult.summary}</span>
                    </div>
                  )}
                  {testResult.flags.length > 0 && (
                    <div className="mt-2">
                      <p className="text-red-500 font-medium">警告:</p>
                      {testResult.flags.map((f, i) => (
                        <p key={i} className="text-red-400">• {f}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
