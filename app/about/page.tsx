// service\app\about\page.tsx
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
const normalizeUrl = (v: string) => {
  if (/^https?:\/\//i.test(v)) return v;
  if (/^www\./i.test(v)) return `https://${v}`;
  return v;
};
const isUrl = (v: string) => {
  try {
    new URL(normalizeUrl(v));
    return true;
  } catch {
    return false;
  }
};
const isPhone = (v: string) => /^[+]?[\d\s().-]{5,}$/.test(v.trim());
const toTelHref = (v: string) => {
  let s = v.trim();
  if (s.startsWith("+")) return `tel:+${s.slice(1).replace(/\D/g, "")}`;
  return `tel:${s.replace(/\D/g, "")}`;
};
const isLineish = (name: string, v: string) =>
  /line/i.test(name) || /^@/.test(v.trim()) || /^line(?:id)?:/i.test(v.trim());
const makeLineUrl = (v: string) => {
  let id = v.trim();
  id = id.replace(/^line(?:id)?:/i, "").trim();
  if (id.startsWith("@")) id = id.slice(1);
  return `https://line.me/R/ti/p/~${encodeURIComponent(id)}`;
};

/** รับได้ทั้งโค้ด <iframe> ทั้งแท่ง, ลิงก์ embed, ลิงก์ปกติ, หรือพิกัด lat,lng */
const extractMapSrc = (raw: string) => {
  if (!raw) return "";
  const s = String(raw).trim();

  const iframeSrc = s.match(/<iframe[^>]*\s+src=["']([^"']+)["']/i);
  if (iframeSrc?.[1]) return iframeSrc[1];

  const directEmbed = s.match(/https?:\/\/www\.google\.com\/maps\/embed\?[^"' <]+/i);
  if (directEmbed?.[0]) return directEmbed[0];

  const anyUrl = s.match(/https?:\/\/[^\s<>"']+/i);
  if (anyUrl?.[0]) {
    const url = anyUrl[0];
    if (/\/maps\/embed/i.test(url)) return url;
    return `https://www.google.com/maps?q=${encodeURIComponent(url)}&output=embed`;
  }

  const coord = s.match(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (coord) {
    return `https://www.google.com/maps?q=${coord[1]},${coord[2]}&output=embed`;
  }
  return "";
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
          axios.get<LocationT>(`${config.apiUrl}/location`, {
            headers: { "Cache-Control": "no-store" },
          }),
          axios.get<ContactT[]>(`${config.apiUrl}/contacts`, {
            headers: { "Cache-Control": "no-store" },
          }),
        ]);
        if (!cancelled) {
          setLoc(locRes?.data || null);
          setContacts(Array.isArray(cRes?.data) ? cRes.data : []);
        }
      } catch (e: any) {
        Swal.fire({
          icon: "error",
          title: "โหลดข้อมูลไม่ได้",
          text: e?.response?.data?.message || String(e),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const mapSrc = useMemo(() => extractMapSrc(loc?.location_map || ""), [loc?.location_map]);

  return (
    <>

      {/* ========= HERO ========= */}
      <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50 to-white">
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-80 w-[1200px] -translate-x-1/2 rounded-[100%] bg-indigo-200/30 blur-3xl" />
        <div className="container mx-auto max-w-6xl px-4 py-12 md:py-16">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
                เกี่ยวกับเรา
              </h1>
              <p className="mt-3 text-slate-600">
                ยินดีต้อนรับสู่ <b>{loc?.location_name || "โรงแรมของเรา"}</b> —
                ติดต่อง่าย แผนที่ชัดเจน เดินทางสะดวก
              </p>

              {/* CTA แถวปุ่มตามข้อมูลที่มี */}
              <div className="mt-6 flex flex-wrap gap-3">
                {loc?.location_link && (
                  <a
                    href={normalizeUrl(loc.location_link)}
                    target="_blank"
                    className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white shadow-sm hover:bg-indigo-700"
                  >
                    <Globe className="h-4 w-4" />
                    เยี่ยมชมหน้าเพจ
                  </a>
                )}
                {(() => {
                  // หาเบอร์โทรตัวแรกจาก contacts
                  const phone = contacts.find((c) => {
                    const v = c.contact_link?.trim() || "";
                    return v && isPhone(v);
                  });
                  if (!phone) return null;
                  const telHref = toTelHref(phone.contact_link || "");
                  return (
                    <a
                      href={telHref}
                      className="cursor-pointer inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-slate-800 hover:bg-slate-50"
                    >
                      <Phone className="h-4 w-4" />
                      โทรหาเรา
                    </a>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========= CONTACTS + MAP ========= */}
      <main className="container mx-auto max-w-6xl px-4 pb-16">
        <div className="grid gap-8 lg:grid-cols-12">
          {/* Contacts */}
          <section className="lg:col-span-5">
            <h2 className="mb-4 text-xl md:text-2xl font-bold text-slate-900">
              ช่องทางการติดต่อ
            </h2>

            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded-xl bg-slate-200/60"
                  />
                ))}
              </div>
            ) : contacts.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500">
                ยังไม่มีข้อมูลติดต่อ
              </div>
            ) : (
              <div className="grid gap-3">
                {contacts.map((c) => {
                  const raw = (c.contact_link || "").trim();
                  const asUrl = raw && isUrl(raw);
                  const asPhone = raw && isPhone(raw);
                  const asLine = raw && isLineish(c.contact_name, raw);

                  const href =
                    asUrl ? normalizeUrl(raw) :
                    asPhone ? toTelHref(raw) :
                    asLine ? makeLineUrl(raw) :
                    undefined;

                  const Icon =
                    asPhone ? Phone :
                    asLine ? MessageSquare :
                    asUrl ? Globe :
                    ExternalLink;

                  return (
                    <a
                      key={c.contact_id}
                      href={href}
                      target={asUrl || asLine ? "_blank" : undefined}
                      className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-50 text-indigo-700">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 leading-tight">
                            {c.contact_name}
                          </div>
                          <div className="truncate text-sm text-slate-600">
                            {raw || "-"}
                          </div>
                        </div>
                        {href && (
                          <ArrowRight className="ml-auto h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5" />
                        )}
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </section>

          {/* Map */}
          <section className="lg:col-span-7">
            <h2 className="mb-4 text-xl md:text-2xl font-bold text-slate-900">
              แผนที่ & การเดินทาง
            </h2>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-slate-700">
                <MapPin className="h-5 w-5 text-indigo-700" />
                <span className="font-semibold">
                  {loc?.location_name || "สถานที่ของเรา"}
                </span>
                {loc?.location_link && (
                  <a
                    href={normalizeUrl(loc.location_link)}
                    target="_blank"
                    className="ml-auto inline-flex items-center gap-1 text-orange-600 hover:text-orange-700 hover:underline"
                  >
                    ไปยังเพจ <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>

              <div className="aspect-[16/9] w-full overflow-hidden rounded-xl ring-1 ring-slate-200">
                {loading ? (
                  <div className="h-full w-full animate-pulse bg-slate-200/60" />
                ) : mapSrc ? (
                  <iframe
                    src={mapSrc}
                    className="h-full w-full"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-slate-500">
                    ยังไม่มีลิงก์แผนที่
                  </div>
                )}
              </div>

              {/* Quick actions */}
              <div className="mt-4 flex flex-wrap gap-3">
                {mapSrc && (
                  <a
                    href={mapSrc}
                    target="_blank"
                    className="cursor-pointer inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-slate-800 hover:bg-slate-50"
                  >
                    เปิดแผนที่จริง <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                {(() => {
                  // email ถ้ามี
                  const email = contacts.find((c) => {
                    const v = (c.contact_link || "").trim();
                    return v && /\S+@\S+\.\S+/.test(v);
                  });
                  if (!email) return null;
                  return (
                    <a
                      href={`mailto:${email.contact_link}`}
                      className="cursor-pointer inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-slate-800 hover:bg-slate-50"
                    >
                      <Mail className="h-4 w-4" />
                      ส่งอีเมล
                    </a>
                  );
                })()}
              </div>
            </div>
          </section>
        </div>
      </main>

    </>
  );
}
