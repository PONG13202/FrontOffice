// service\app\profile\page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { config } from "@/app/config";
import { cn } from "@/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Upload,
  Camera,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";


/* ======================================================
   User Profile Page (self-service)
   ====================================================== */

// ---- Helpers
const AUTH_TOKEN_KEYS = ["auth:token", "token", "jwt", "access_token"];
function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  for (const k of AUTH_TOKEN_KEYS) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return null;
}
function authHeaders() {
  const t = getAuthToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// ---- Types
interface MeDTO {
  user_id: number;
  user_name?: string | null;
  user_email: string;
  user_fname?: string | null;
  user_lname?: string | null;
  user_phone?: string | null;
  user_img?: string | null;
}

/* ---------- Wrapper: require password before enter ---------- */
export default function ProfileWrapper() {
  const [verified, setVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(false);

  async function handleVerify() {
    try {
      setChecking(true);
      await axios.post(
        `${config.apiUrl}/verify_password`, // เปลี่ยนเป็น verify_password
        { password },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );
      setVerified(true);
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "รหัสผ่านไม่ถูกต้อง",
        text: err?.response?.data?.message || err.message,
        showConfirmButton: false,
        timer: 2000,
      });
    } finally {
      setChecking(false);
    }
  }

  if (!verified) {
    return (
      <>
        
        <div className="min-h-[60vh] grid place-items-center">
          <div className="p-6 bg-white rounded-lg shadow-md w-full max-w-sm">
            <h2 className="text-lg font-semibold mb-4">ยืนยันรหัสผ่าน</h2>
            <Input
              type="password"
              placeholder="กรอกรหัสผ่าน"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleVerify();
                }
              }}
            />
            <Button
              className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleVerify}
              disabled={checking}
            >
              {checking ? "กำลังตรวจสอบ..." : "ยืนยัน"}
            </Button>
          </div>
        </div>

      </>
    );
  }

  return <ProfilePage />;
}

/* ---------- Main Profile Page ---------- */
function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [me, setMe] = useState<MeDTO | null>(null);

  // form state
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // username availability
  const [uChecking, setUChecking] = useState(false);
  const [uAvailable, setUAvailable] = useState<boolean | null>(null);
  const uTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [uMessage, setUMessage] = useState<string>("");

  // password fields
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);

  function normalizeAvatarUrl(pathStr: string) {
    if (!pathStr) return "";
    if (pathStr.startsWith("http")) return pathStr;
    return `${config.apiUrl}/${pathStr.replace(/^\//, "")}`;
  }

  // Load profile
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${config.apiUrl}/user_info`, {
          headers: authHeaders(),
        });
        const data: MeDTO = res.data;
        if (!cancelled && data) {
          setMe(data);
          setUsername(data.user_name || "");
          setFirstName(data.user_fname || "");
          setLastName(data.user_lname || "");
          setEmail(data.user_email || "");
          setPhone(data.user_phone || "");
          setAvatarPreview(
            data.user_img ? normalizeAvatarUrl(data.user_img) : null
          );
        }
      } catch (err: any) {
        Swal.fire({
          icon: "error",
          title: "โหลดโปรไฟล์ไม่สำเร็จ",
          text: err?.response?.data?.message || err.message,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (uTimer.current) clearTimeout(uTimer.current);
    };
  }, []);

  // Debounced username check
  useEffect(() => {
    if (!username) {
      setUAvailable(null);
      setUMessage("");
      return;
    }

    if (me && username === (me.user_name || "")) {
      setUAvailable(true);
      setUMessage("ชื่อผู้ใช้นี้เป็นของคุณอยู่แล้ว");
      return;
    }

    if (uTimer.current) clearTimeout(uTimer.current);
    uTimer.current = setTimeout(async () => {
      try {
        setUChecking(true);
        const resp = await axios.get(`${config.apiUrl}/check_user`, {
          headers: authHeaders(),
          params: { user_name: username },
        });
        const ok = !!resp.data?.available;
        setUAvailable(ok);
        setUMessage(
          ok ? "ชื่อผู้ใช้ว่าง สามารถใช้ได้" : "มีผู้ใช้งานชื่อนี้แล้ว"
        );
      } catch {
        setUAvailable(null);
        setUMessage("ตรวจสอบชื่อผู้ใช้ไม่สำเร็จ");
      } finally {
        setUChecking(false);
      }
    }, 500);
  }, [username, me]);

  // Avatar preview
  useEffect(() => {
    if (!avatarFile) return;
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  async function handleSaveBasic() {
    if (!email) {
      Swal.fire({ icon: "warning", title: "กรอกอีเมล" });
      return;
    }
    if (username && uAvailable === false) {
      Swal.fire({ icon: "warning", title: "ชื่อผู้ใช้ซ้ำ" });
      return;
    }

    try {
      setSaving(true);
      let avatarPath: string | undefined;
      if (avatarFile) {
        const fd = new FormData();
        fd.append("file", avatarFile);
        const up = await axios.post(`${config.apiUrl}/upload_avatar`, fd, {
          headers: { ...authHeaders(), "Content-Type": "multipart/form-data" },
        });
        avatarPath = up.data?.path || up.data?.url;
      }

      const payload: Record<string, any> = {
        user_name: username || null,
        user_fname: firstName || null,
        user_lname: lastName || null,
        user_phone: phone || null,
      };
      if (avatarPath) payload.user_img = avatarPath;

      const res = await axios.put(`${config.apiUrl}/update_profile`, payload, {
        headers: authHeaders(),
      });
      const updated: MeDTO = res.data;

      setMe(updated);
      setUsername(updated.user_name || "");
      setFirstName(updated.user_fname || "");
      setLastName(updated.user_lname || "");
      setEmail(updated.user_email || "");
      setPhone(updated.user_phone || "");
      setAvatarPreview(
        updated.user_img ? normalizeAvatarUrl(updated.user_img) : null
      );
      setAvatarFile(null);

      Swal.fire({
        icon: "success",
        title: "บันทึกสำเร็จ",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "บันทึกไม่สำเร็จ",
        text: err?.response?.data?.message || err.message,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    if (!currentPwd || !newPwd || !confirmPwd) {
      Swal.fire({ icon: "warning", title: "กรอกข้อมูลให้ครบ" });
      return;
    }
    if (newPwd.length < 6) {
      Swal.fire({ icon: "warning", title: "รหัสผ่านสั้นเกินไป" });
      return;
    }
    if (newPwd !== confirmPwd) {
      Swal.fire({ icon: "warning", title: "รหัสผ่านไม่ตรงกัน" });
      return;
    }

    try {
      setPwdSaving(true);
      await axios.post(
        `${config.apiUrl}/change_password`,
        { currentPassword: currentPwd, newPassword: newPwd },
        { headers: authHeaders() }
      );
      Swal.fire({
        icon: "success",
        title: "เปลี่ยนรหัสผ่านแล้ว",
        timer: 1200,
        showConfirmButton: false,
      });
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "เปลี่ยนรหัสผ่านไม่สำเร็จ",
        text: err?.response?.data?.message || err.message,
      });
    } finally {
      setPwdSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        กำลังโหลดโปรไฟล์...
      </div>
    );
  }

  return (
    <>
      
      <div className="mx-auto max-w-4xl p-6 md:p-10 space-y-10">
        <h1 className="text-3xl font-bold text-indigo-600">โปรไฟล์ของฉัน</h1>
        <p className="text-muted-foreground">
          จัดการข้อมูลบัญชีและความปลอดภัยของคุณ
        </p>

        <div className="grid md:grid-cols-2 gap-8">
          {/* ข้อมูลส่วนตัว */}
          <Card className="shadow-lg border-indigo-200">
            <CardHeader className="bg-indigo-50">
              <CardTitle className="text-indigo-700">ข้อมูลส่วนตัว</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 mt-4">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-full overflow-hidden bg-muted flex items-center justify-center border-2 border-indigo-200">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="avatar"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Camera className="h-7 w-7 text-indigo-400" />
                  )}
                </div>
                <div className="space-x-2">
                  <label className="inline-flex items-center">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        setAvatarFile(e.target.files?.[0] || null)
                      }
                    />
                    <span className="inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm cursor-pointer bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
                      <Upload className="h-4 w-4" /> อัปโหลดรูป
                    </span>
                  </label>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4">
                <div>
                  <Label>อีเมล</Label>
                  <Input value={email} readOnly className="bg-muted/40" />
                </div>
                <div>
                  <Label>ชื่อผู้ใช้</Label>
                  <div className="relative">
                    <Input
                      value={username}
                      onChange={(e) => setUsername(e.target.value.trim())}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      {uChecking ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : uAvailable == null ? null : uAvailable ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                  </div>
                  {uMessage && (
                    <p
                      className={cn(
                        "text-xs",
                        uAvailable === false
                          ? "text-red-500"
                          : "text-muted-foreground"
                      )}
                    >
                      {uMessage}
                    </p>
                  )}
                </div>
                <div>
                  <Label>ชื่อ</Label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div>
                  <Label>นามสกุล</Label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
                <div>
                  <Label>เบอร์โทร</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button
                onClick={handleSaveBasic}
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  "บันทึก"
                )}
              </Button>
            </CardFooter>
          </Card>

          {/* ความปลอดภัย */}
          <Card className="shadow-lg border-rose-200">
            <CardHeader className="bg-rose-50">
              <CardTitle className="text-rose-700">
                ความปลอดภัยของบัญชี
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 mt-4">
              <div>
                <Label>รหัสผ่านปัจจุบัน</Label>
                <Input
                  type="password"
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                />
              </div>
              <div>
                <Label>รหัสผ่านใหม่</Label>
                <Input
                  type="password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                />
              </div>
              <div>
                <Label>ยืนยันรหัสผ่านใหม่</Label>
                <Input
                  type="password"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button
                onClick={handleChangePassword}
                disabled={pwdSaving}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {pwdSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  "เปลี่ยนรหัสผ่าน"
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </>
  );
}
