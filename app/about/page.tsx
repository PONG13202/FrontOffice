"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Image from "next/image";
import Swal from "sweetalert2";
import { config } from "@/app/config";
import {
  ExternalLink,
  MapPin,
  Phone,
  Globe,
  MessageSquare,
  Mail,
  ArrowRight,
} from "lucide-react";

/* ================= Types ================= */
type LocationT = {
  location_id: number;
  location_name: string;
  location_link: string;
  location_map: string;
};
type ContactT = {
  contact_id: number;
  contact_name: string;
  contact_link?: string | null;
};

/* ================= Helpers ================= */
const normalizeUrl = (v: string) => (/^https?:\/\//i.test(v) ? v : /^www\./i.test(v) ? `https://${v}` : v);
const isUrl = (v: string) => {
  try {
    new URL(normalizeUrl(v));
    return true;
  } catch {
    return false;
  }
};
const isPhone = (v: string) => /^[+]?[\d\s().-]{5,}$/.test(v.trim());
const toTelHref = (v: string) => `tel:${v.trim().replace(/\D/g, "").replace(/^(\+)?/, "+$1")}`;
const isLineish = (name: string, v: string) => /line/i.test(name) || /^@/.test(v.trim()) || /^line(?:id)?:/i.test(v.trim());
const makeLineUrl = (v: string) => {
  let id = v.trim().replace(/^line(?:id)?:/i, "").replace(/^@/, "");
  return `https://line.me/R/ti/p/~${encodeURIComponent(id)}`;
};

const extractMapSrc = (raw: string) => {
  if (!raw) return "";
  const s = raw.trim();
  const iframeSrc = s.match(/<iframe[^>]*\s+src=["']([^"']+)["']/i)?.[1];
  if (iframeSrc) return iframeSrc;
  const directEmbed = s.match(/https?:\/\/www\.google\.com\/maps\/embed\?[^"' <]+/i)?.[0];
  if (directEmbed) return directEmbed;
  const anyUrl = s.match(/https?:\/\/[^\s<>"']+/i)?.[0];
  if (anyUrl && /\/maps\/embed/i.test(anyUrl)) return anyUrl;
  if (anyUrl) return `https://www.google.com/maps?q=${encodeURIComponent(anyUrl)}&output=embed`;
  const coord = s.match(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  return coord ? `https://www.google.com/maps?q=${coord[1]},${coord[2]}&output=embed` : "";
};

/* ================= Page ================= */
export default function AboutPage() {
  const [loc, setLoc] = useState<LocationT | null>(null);
  const [contacts, setContacts] = useState<ContactT[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [locRes, cRes] = await Promise.all([
          axios.get<LocationT>(`${config.apiUrl}/location`, { headers: { "Cache-Control": "no-store" } }),
          axios.get<ContactT[]>(`${config.apiUrl}/contacts`, { headers: { "Cache-Control": "no-store" } }),
        ]);
        if (!cancelled) {
          setLoc(locRes.data || null);
          setContacts(Array.isArray(cRes.data) ? cRes.data : []);
        }
      } catch (e: any) {
        Swal.fire({ icon: "error", title: "โหลดข้อมูลไม่ได้", text: e?.response?.data?.message || String(e) });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const mapSrc = useMemo(() => extractMapSrc(loc?.location_map || ""), [loc?.location_map]);

  return (
    <>
      {/* ========= HERO ========= */}
      <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50 to-white">
        <div aria-hidden className="absolute -top-20 left-1/2 h-64 w-[1000px] -translate-x-1/2 rounded-full bg-indigo-200/30 blur-2xl" />
        <div className="container mx-auto max-w-6xl px-4 py-8 sm:py-12">
          <div className="grid gap-6 md:grid-cols-2 md:items-center">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">เกี่ยวกับเรา</h1>
              <p className="mt-2 text-sm sm:text-base text-slate-600">
                ยินดีต้อนรับสู่ <b>{loc?.location_name || "โรงแรมของเรา"}</b> — ติดต่อง่าย แผนที่ชัดเจน เดินทางสะดวก
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {loc?.location_link && (
                  <a href={normalizeUrl(loc.location_link)} target="_blank" className="inline-flex items-center gap-2 rounded bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-700">
                    <Globe className="h-4 w-4" /> เยี่ยมชมหน้าเพจ
                  </a>
                )}
                {contacts.find(c => isPhone(c.contact_link || "")) && (
                  <a href={toTelHref(contacts.find(c => isPhone(c.contact_link || ""))!.contact_link || "")} className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-slate-800 hover:bg-slate-50">
                    <Phone className="h-4 w-4" /> โทรหาเรา
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========= CONTACTS + MAP ========= */}
      <main className="container mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Contacts */}
          <section className="lg:col-span-5">
            <h2 className="mb-3 text-lg sm:text-xl font-bold text-slate-900">ช่องทางการติดต่อ</h2>
            {loading ? (
              <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded bg-slate-200/60" />)}</div>
            ) : contacts.length === 0 ? (
              <div className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-500">ยังไม่มีข้อมูลติดต่อ</div>
            ) : (
              <div className="grid gap-3">
                {contacts.map(c => {
                  const raw = c.contact_link?.trim() || "";
                  const asUrl = isUrl(raw);
                  const asPhone = isPhone(raw);
                  const asLine = isLineish(c.contact_name, raw);
                  const href = asUrl ? normalizeUrl(raw) : asPhone ? toTelHref(raw) : asLine ? makeLineUrl(raw) : undefined;
                  const Icon = asPhone ? Phone : asLine ? MessageSquare : asUrl ? Globe : ExternalLink;
                  return href ? (
                    <a
                      key={c.contact_id}
                      href={href}
                      target={asUrl || asLine ? "_blank" : undefined}
                      className="group flex items-center gap-3 rounded border border-slate-200 bg-white p-3 hover:bg-slate-50 hover:shadow-sm"
                    >
                      <div className="grid h-9 w-9 place-items-center rounded bg-indigo-50 text-indigo-700">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 text-sm">{c.contact_name}</div>
                        <div className="truncate text-xs text-slate-600">{raw}</div>
                      </div>
                      <ArrowRight className="ml-auto h-4 w-4 text-slate-400 transition group-hover:translate-x-1" />
                    </a>
                  ) : null;
                })}
              </div>
            )}
          </section>

          {/* Map */}
          <section className="lg:col-span-7">
            <h2 className="mb-3 text-lg sm:text-xl font-bold text-slate-900">แผนที่ & การเดินทาง</h2>
            <div className="rounded border border-slate-200 bg-white p-3 sm:p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-sm sm:text-base text-slate-700">
                <MapPin className="h-5 w-5 text-indigo-700" />
                <span className="font-medium">{loc?.location_name || "สถานที่ของเรา"}</span>
                {loc?.location_link && (
                  <a href={normalizeUrl(loc.location_link)} target="_blank" className="ml-auto inline-flex items-center gap-1 text-orange-600 hover:text-orange-700 hover:underline">
                    ไปยังเพจ <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <div className="aspect-video w-full overflow-hidden rounded ring-1 ring-slate-200">
                {loading ? (
                  <div className="h-full w-full animate-pulse bg-slate-200/60" />
                ) : mapSrc ? (
                  <iframe src={mapSrc} className="h-full w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                ) : (
                  <div className="grid h-full place-items-center text-sm text-slate-500">ยังไม่มีลิงก์แผนที่</div>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {mapSrc && (
                  <a href={mapSrc} target="_blank" className="inline-flex items-center gap-2 rounded border border-slate-300 px-2 py-1 text-sm text-slate-800 hover:bg-slate-50">
                    เปิดแผนที่จริง <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                {contacts.find(c => /\S+@\S+\.\S+/.test(c.contact_link || "")) && (
                  <a href={`mailto:${contacts.find(c => /\S+@\S+\.\S+/.test(c.contact_link || ""))!.contact_link}`} className="inline-flex items-center gap-2 rounded border border-slate-300 px-2 py-1 text-sm text-slate-800 hover:bg-slate-50">
                    <Mail className="h-4 w-4" /> ส่งอีเมล
                  </a>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}