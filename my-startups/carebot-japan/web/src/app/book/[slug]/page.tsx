"use client";
import { useState, useEffect, type ReactNode } from "react";

type Lang = "en" | "ja";

const tx = {
  en: {
    loading: "Loading...",
    not_found: "Clinic not found.",
    not_found_sub: "This booking link may be invalid or expired.",
    title: "Book an Appointment",
    subtitle: "Fill in your details and we'll confirm your appointment.",
    name: "Full name",
    name_ph: "Tanaka Yuki",
    email: "Email address",
    email_ph: "tanaka@example.com",
    phone: "Phone number",
    phone_ph: "090-1234-5678",
    date: "Preferred date",
    time: "Preferred time",
    reason: "Reason for visit",
    reason_ph: "Regular checkup, cold symptoms, etc.",
    first_visit: "Is this your first visit?",
    first_yes: "First visit",
    first_no: "Return visit",
    submit: "Request Appointment",
    submitting: "Submitting...",
    success_title: "Appointment Confirmed!",
    success_body: "A confirmation email has been sent to your inbox.",
    success_name: "Name",
    success_date: "Requested date",
    success_time: "Requested time",
    success_reason: "Reason",
    success_another: "Book another appointment",
    error: "Something went wrong. Please try again.",
    required: "Name is required.",
    powered: "Powered by CareBot Japan",
    checking: "Checking availability...",
    closed: "The clinic is closed on this day. Please choose another date.",
    no_slots: "No available slots.",
  },
  ja: {
    loading: "読み込み中...",
    not_found: "クリニックが見つかりません。",
    not_found_sub: "この予約リンクは無効または期限切れの可能性があります。",
    title: "予約申し込み",
    subtitle: "以下のフォームにご記入ください。確認後にご連絡いたします。",
    name: "お名前",
    name_ph: "田中 雪",
    email: "メールアドレス",
    email_ph: "tanaka@example.com",
    phone: "電話番号",
    phone_ph: "090-1234-5678",
    date: "ご希望の日付",
    time: "ご希望の時間",
    reason: "来院の理由",
    reason_ph: "定期検診、風邪の症状など",
    first_visit: "初診ですか？",
    first_yes: "初診",
    first_no: "再診",
    submit: "予約を申し込む",
    submitting: "送信中...",
    success_title: "予約が確定しました",
    success_body: "確認メールをお送りしました。ご確認ください。",
    success_name: "お名前",
    success_date: "ご希望日",
    success_time: "ご希望時間",
    success_reason: "来院理由",
    success_another: "別の予約を申し込む",
    error: "エラーが発生しました。もう一度お試しください。",
    required: "お名前は必須です。",
    powered: "Powered by CareBot Japan",
    checking: "空き枠を確認中...",
    closed: "この日はクリニックがお休みです。別の日をお選びください。",
    no_slots: "空き枠がありません。",
  },
};

interface ClinicInfo {
  clinic_id: string;
  name: string;
}

interface Result {
  status: string;
  appointment_id: string | null;
  patient_name: string;
  preferred_date: string | null;
  preferred_time: string | null;
  email_sent: boolean;
}

export default function ClinicBookPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const [lang, setLang] = useState<Lang>("ja");
  const t = tx[lang];

  const [clinic, setClinic] = useState<ClinicInfo | null>(null);
  const [clinicLoading, setClinicLoading] = useState(true);
  const [clinicNotFound, setClinicNotFound] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [firstVisit, setFirstVisit] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const [slots, setSlots] = useState<{ time: string; available: boolean }[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [clinicClosed, setClinicClosed] = useState(false);

  // Fetch clinic info by slug
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api-proxy/clinics/by-slug/${slug}`);
        if (!res.ok) { setClinicNotFound(true); return; }
        setClinic(await res.json());
      } catch {
        setClinicNotFound(true);
      } finally {
        setClinicLoading(false);
      }
    }
    load();
  }, [slug]);

  async function handleDateChange(d: string) {
    setDate(d);
    setTime("");
    setSlots([]);
    setClinicClosed(false);
    if (!d || !clinic) return;
    setSlotsLoading(true);
    try {
      const res = await fetch(`/api-proxy/appointments/slots?clinic_id=${clinic.clinic_id}&date=${d}`);
      const data = await res.json();
      if (!data.is_open) setClinicClosed(true);
      else setSlots(data.slots || []);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError(t.required); return; }
    if (!clinic) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api-proxy/appointments/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinic_id: clinic.clinic_id,
          lang,
          patient_name: name.trim(),
          patient_email: email.trim() || null,
          patient_phone: phone.trim() || null,
          preferred_date: date || null,
          preferred_time: time || null,
          visit_reason: reason.trim() || null,
          is_first_visit: firstVisit,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json());
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setResult(null);
    setName(""); setEmail(""); setPhone("");
    setDate(""); setTime(""); setReason("");
    setFirstVisit(null); setSlots([]); setClinicClosed(false);
  }

  if (clinicLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">{t.loading}</p>
      </div>
    );
  }

  if (clinicNotFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-base font-semibold text-gray-800 mb-2">{t.not_found}</p>
          <p className="text-sm text-gray-400">{t.not_found_sub}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-6">
          <p className="font-semibold text-teal-800 text-lg">{clinic?.name}</p>
          <div className="flex justify-center mt-2">
            <button
              onClick={() => setLang(lang === "en" ? "ja" : "en")}
              className="text-xs text-gray-400 border border-gray-200 rounded-lg px-3 py-1 hover:border-teal-400 hover:text-teal-600 transition-colors"
            >
              {lang === "en" ? "🇯🇵 日本語" : "🇬🇧 English"}
            </button>
          </div>
        </div>

        {/* Success screen */}
        {result ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm text-center">
            <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-4">
              <span className="text-teal-600 text-2xl">✓</span>
            </div>
            <h1 className="text-lg font-semibold text-gray-900 mb-1">{t.success_title}</h1>
            <p className="text-sm text-gray-500 mb-1">{t.success_body}</p>
            {result.email_sent && (
              <p className="text-xs text-teal-600 mb-5 mt-1">
                {lang === "ja" ? "✓ 確認メール送信済み" : "✓ Confirmation email sent"}
              </p>
            )}
            {!result.email_sent && <div className="mb-5" />}
            <div className="text-left space-y-3 bg-gray-50 rounded-xl p-4 mb-6">
              <Row label={t.success_name} value={result.patient_name} />
              {result.preferred_date && <Row label={t.success_date} value={result.preferred_date} />}
              {result.preferred_time && <Row label={t.success_time} value={result.preferred_time} />}
              {reason && <Row label={t.success_reason} value={reason} />}
            </div>
            <button
              onClick={resetForm}
              className="text-sm text-teal-600 hover:text-teal-800 underline transition-colors"
            >
              {t.success_another}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-7 shadow-sm">
            <h1 className="text-base font-semibold text-gray-900 mb-1">{t.title}</h1>
            <p className="text-xs text-gray-400 mb-6">{t.subtitle}</p>

            <div className="space-y-4">
              <Field label={t.name} required>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder={t.name_ph} required className="input" />
              </Field>

              <Field label={t.email} required>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder={t.email_ph} required className="input" />
              </Field>

              <Field label={t.phone}>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder={t.phone_ph} className="input" />
              </Field>

              <Field label={t.date}>
                <input type="date" value={date}
                  onChange={e => handleDateChange(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="input" />
              </Field>

              {date && (
                <Field label={t.time}>
                  {slotsLoading ? (
                    <p className="text-xs text-gray-400 py-2">{t.checking}</p>
                  ) : clinicClosed ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <p className="text-xs text-amber-700">{t.closed}</p>
                    </div>
                  ) : slots.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">{t.no_slots}</p>
                  ) : (
                    <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
                      {slots.map(s => (
                        <button key={s.time} type="button"
                          disabled={!s.available}
                          onClick={() => s.available && setTime(s.time)}
                          className={`text-xs py-1.5 rounded-lg border transition-colors ${
                            time === s.time
                              ? "bg-teal-600 text-white border-teal-600"
                              : s.available
                              ? "border-gray-200 text-gray-700 hover:border-teal-400 hover:text-teal-700"
                              : "border-gray-100 text-gray-300 bg-gray-50 cursor-not-allowed line-through"
                          }`}>
                          {s.time}
                        </button>
                      ))}
                    </div>
                  )}
                </Field>
              )}

              <Field label={t.reason}>
                <input type="text" value={reason} onChange={e => setReason(e.target.value)}
                  placeholder={t.reason_ph} className="input" />
              </Field>

              <Field label={t.first_visit}>
                <div className="flex gap-2">
                  {[{ val: true, label: t.first_yes }, { val: false, label: t.first_no }].map(({ val, label }) => (
                    <button key={label} type="button"
                      onClick={() => setFirstVisit(firstVisit === val ? null : val)}
                      className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                        firstVisit === val
                          ? "bg-teal-800 text-white border-teal-800"
                          : "border-gray-200 text-gray-600 hover:border-teal-400"
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="mt-6 w-full py-2.5 bg-teal-800 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors">
              {loading ? t.submitting : t.submit}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-gray-300 mt-6">{t.powered}</p>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-800 font-medium">{value}</span>
    </div>
  );
}
