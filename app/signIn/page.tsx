"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import Swal from "sweetalert2";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GoogleLogin, CredentialResponse } from "@react-oauth/google";
import SignInCompletion from "../components/SignInCompletion"; // ✅ ใช้คอมโพเนนต์ที่ตรงกัน
import { config } from "../config";

export default function LoginPage() {
  const router = useRouter();

  // --- state สำหรับหน้า login ปกติ ---
  const [form, setForm] = useState({ user_name: "", user_pass: "" });
  const [loadingLogin, setLoadingLogin] = useState(false);

  // --- state สำหรับ modal โปรไฟล์ (กรณี Google โปรไฟล์ไม่ครบ) ---
  const [profileForm, setProfileForm] = useState({
    user_name: "",
    user_pass: "",
    confirm_pass: "",
    user_fname: "",
    user_lname: "",
    user_email: "",
    user_phone: "",
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [openModal, setOpenModal] = useState(false);

  // สถานะตรวจซ้ำ/validate ใน modal
  const [usernameStatus, setUsernameStatus] = useState("");
  const [emailStatus, setEmailStatus] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(false);

  // --- debounce check username ---
  useEffect(() => {
    const timeout = setTimeout(async () => {
      const name = profileForm.user_name.trim();
      if (!name) {
        setUsernameStatus("");
        return;
      }
      try {
        const res = await axios.get(
          `${config.apiUrl}/check_username?user_name=${encodeURIComponent(name)}`
        );
        setUsernameStatus(res.data?.available ? "" : "ชื่อผู้ใช้นี้ถูกใช้ไปแล้ว");
      } catch {
        setUsernameStatus("ไม่สามารถตรวจสอบชื่อผู้ใช้ได้");
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [profileForm.user_name]);

  // --- debounce check email ---
  useEffect(() => {
    const timeout = setTimeout(async () => {
      const mail = profileForm.user_email.trim();
      if (!mail) {
        setEmailStatus("");
        return;
      }
      try {
        const res = await axios.get(
          `${config.apiUrl}/check_email?user_email=${encodeURIComponent(mail)}`
        );
        setEmailStatus(res.data?.available ? "" : "อีเมลนี้ถูกใช้ไปแล้ว");
      } catch {
        setEmailStatus("ไม่สามารถตรวจสอบอีเมลได้");
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [profileForm.user_email]);

  // --- validate password / confirm password ---
  useEffect(() => {
    if (profileForm.user_pass.length > 0 && profileForm.user_pass.length < 6) {
      setPasswordError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
    } else {
      setPasswordError("");
    }
    if (
      profileForm.confirm_pass.length > 0 &&
      profileForm.user_pass !== profileForm.confirm_pass
    ) {
      setConfirmPasswordError("รหัสผ่านไม่ตรงกัน");
    } else {
      setConfirmPasswordError("");
    }
  }, [profileForm.user_pass, profileForm.confirm_pass]);

  // --- handlers ---
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, files } = e.target;
    if (name === "user_img" && files && files[0]) {
      setSelectedImage(files[0]);
    } else {
      setProfileForm({ ...profileForm, [name]: value });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loadingLogin) return;

    setLoadingLogin(true);
    try {
      const res = await axios.post(`${config.apiUrl}/signin`, form);
      if (res.status === 200) {
        localStorage.setItem("token", res.data.token);
        await Swal.fire({
          icon: "success",
          title: "เข้าสู่ระบบสำเร็จ",
          showConfirmButton: false,
          timer: 1200,
        });
        router.push("/home");
      }
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "เกิดข้อผิดพลาด",
        showConfirmButton: false,
        timer: 2000,
        text: err.response?.data?.message || "เกิดข้อผิดพลาด",
      });
    } finally {
      setLoadingLogin(false);
    }
  };

  const handleGoogleLoginSuccess = async (
    credentialResponse: CredentialResponse
  ) => {
    try {
      if (!credentialResponse.credential) {
        throw new Error("ไม่พบ credential จาก Google");
      }
      const token = credentialResponse.credential;
      const res = await axios.post(`${config.apiUrl}/google_signin`, { token });

      if (res.status === 200) {
        if (res.data?.incompleteProfile) {
          setMissingFields(res.data.missingFields || []);
          setProfileForm({
            user_name: res.data.googleUser?.user_name ?? "",
            user_pass: "",
            confirm_pass: "",
            user_fname: res.data.googleUser?.first_name ?? "",
            user_lname: res.data.googleUser?.last_name ?? "",
            user_email: res.data.googleUser?.email ?? "",
            user_phone: res.data.googleUser?.phone ?? "",
          });
          setSelectedImage(null);
          localStorage.setItem("tempToken", res.data.tempToken);
          setOpenModal(true);
        } else {
          localStorage.setItem("token", res.data.token);
          await Swal.fire({
            icon: "success",
            title: "เข้าสู่ระบบด้วย Google สำเร็จ",
            showConfirmButton: false,
            timer: 1200,
          });
          router.push("/home");
        }
      }
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "เข้าสู่ระบบด้วย Google ล้มเหลว",
        showConfirmButton: false,
        timer: 2000,
        text:
          err.response?.data?.message ||
          err.message ||
          "เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย Google",
      });
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loadingProfile) return;

    // validation เบื้องต้น
    const emailOk = /\S+@\S+\.\S+/.test(profileForm.user_email);
    if (!emailOk) {
      Swal.fire({ icon: "error", title: "อีเมลไม่ถูกต้อง" });
      return;
    }
    if (
      !profileForm.user_name ||
      !profileForm.user_pass ||
      !profileForm.confirm_pass ||
      !profileForm.user_fname ||
      !profileForm.user_lname ||
      !profileForm.user_email
    ) {
      Swal.fire({
        icon: "error",
        title: "เกิดข้อผิดพลาด",
        text: "กรุณากรอกข้อมูลให้ครบทุกช่อง",
      });
      return;
    }
    if (
      passwordError ||
      confirmPasswordError ||
      usernameStatus ||
      emailStatus
    ) {
      Swal.fire({
        icon: "error",
        title: "ข้อมูลไม่ถูกต้อง",
        text: "กรุณาแก้ไขข้อมูลที่มีข้อผิดพลาด",
      });
      return;
    }

    setLoadingProfile(true);
    try {
      const token = localStorage.getItem("tempToken");
      if (!token) throw new Error("ไม่พบ Token ชั่วคราวสำหรับการกรอกข้อมูลโปรไฟล์");

      const formData = new FormData();
      formData.append("user_name", profileForm.user_name);
      formData.append("user_pass", profileForm.user_pass);
      formData.append("user_fname", profileForm.user_fname);
      formData.append("user_lname", profileForm.user_lname);
      formData.append("user_email", profileForm.user_email);
      formData.append("user_phone", profileForm.user_phone);
      if (selectedImage) formData.append("user_img", selectedImage);

      const res = await axios.post(`${config.apiUrl}/add_profile`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      localStorage.setItem("token", res.data.token);
      localStorage.removeItem("tempToken");
      await Swal.fire({
        icon: "success",
        title: "เพิ่มข้อมูลสำเร็จ",
        showConfirmButton: false,
        timer: 1200,
      });
      setOpenModal(false);
      router.push("/home");
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "เกิดข้อผิดพลาด",
        showConfirmButton: false,
        timer: 2000,
        text:
          err.response?.data?.message ||
          err.message ||
          "เกิดข้อผิดพลาดในการอัปเดตข้อมูล",
      });
    } finally {
      setLoadingProfile(false);
    }
  };

  // --- UI ---
  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50 font-prompt">
      <Card className="w-full max-w-md shadow-lg border border-blue-200">
        <CardHeader>
          <CardTitle className="text-center text-3xl font-semibold text-blue-800">
            เข้าสู่ระบบ
          </CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Username or Email
              </label>
              <Input
                type="text"
                name="user_name"
                value={form.user_name}
                onChange={handleChange}
                placeholder="ชื่อผู้ใช้"
                required
                className="border-blue-300 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <Input
                type="password"
                name="user_pass"
                value={form.user_pass}
                onChange={handleChange}
                placeholder="รหัสผ่าน"
                required
                className="border-blue-300 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <Button
              type="submit"
              disabled={loadingLogin}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              {loadingLogin ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </Button>
          </form>

          <div className="my-4 flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleLoginSuccess}
              onError={() =>
                Swal.fire({
                  icon: "error",
                  title: "Google Login ล้มเหลว",
                  timer: 1800,
                  showConfirmButton: false,
                })
              }
            />
          </div>

          <p className="text-center text-sm text-gray-600">
            ยังไม่มีบัญชี?{" "}
            <Link href="/signUp" className="text-blue-600 hover:underline">
              สมัครสมาชิก
            </Link>
          </p>
        </CardContent>
      </Card>

<SignInCompletion
  open={openModal}
  onOpenChange={setOpenModal}
  missingFields={missingFields}
  submitting={
    loadingProfile ||
    !!passwordError ||
    !!confirmPasswordError ||
    !!usernameStatus ||
    !!emailStatus
  }
  usernameStatus={usernameStatus}
  emailStatus={emailStatus}
  passwordError={passwordError}
  confirmPasswordError={confirmPasswordError}
  profileForm={profileForm}
  onProfileChange={handleProfileChange}
  onProfileSubmit={handleProfileSubmit}
/>

    </div>
  );
}
