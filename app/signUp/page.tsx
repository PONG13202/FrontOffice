"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { config } from "../config";
import Swal from "sweetalert2";

export default function SignUp() {
  const router = useRouter();

  // ✅ guard: กันผู้ใช้ที่ล็อกอินแล้วเข้าหน้านี้
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    let ignore = false;
    const run = async () => {
      const token = localStorage.getItem("token");
      if (!token) { setChecking(false); return; }
      try {
        await axios.get(`${config.apiUrl}/user_info`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!ignore) router.replace("/"); // ล็อกอินแล้ว → เด้งออก
      } catch {
        localStorage.removeItem("token");
        if (!ignore) setChecking(false);
      }
    };
    run();
    return () => { ignore = true; };
  }, [router]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fname, setFname] = useState("");
  const [lname, setLname] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState("");
  const [emailStatus, setEmailStatus] = useState("");
  const [formError, setFormError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");

  // Check username availability
  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (username.trim()) {
        try {
          const res = await axios.get(
            `${config.apiUrl}/check_user?user_name=${encodeURIComponent(username)}`
          );
          setUsernameStatus(res.data.available ? "" : "ชื่อผู้ใช้นี้ถูกใช้ไปแล้ว");
        } catch {
          setUsernameStatus("ไม่สามารถตรวจสอบชื่อผู้ใช้ได้");
        }
      } else {
        setUsernameStatus("");
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [username]);

  // Check email availability
  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (email.trim()) {
        try {
          const res = await axios.get(
            `${config.apiUrl}/check_mail?user_email=${encodeURIComponent(email)}`
          );
          setEmailStatus(res.data.available ? "" : "อีเมลนี้ถูกใช้ไปแล้ว");
        } catch {
          setEmailStatus("ไม่สามารถตรวจสอบอีเมลได้");
        }
      } else {
        setEmailStatus("");
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [email]);

  // Handle password change and validation
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    if (value.length < 6) {
      setPasswordError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
    } else {
      setPasswordError("");
    }
    if (confirmPassword && value !== confirmPassword) {
      setConfirmPasswordError("รหัสผ่านไม่ตรงกัน");
    } else {
      setConfirmPasswordError("");
    }
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setConfirmPassword(value);
    if (value !== password) {
      setConfirmPasswordError("รหัสผ่านไม่ตรงกัน");
    } else {
      setConfirmPasswordError("");
    }
  };

  // Handle image selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImage(e.target.files[0]);
    } else {
      setSelectedImage(null);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    setFormError("");
    setPasswordError("");
    setConfirmPasswordError("");

    if (!username || !password || !confirmPassword || !fname || !lname || !email) {
      setFormError("กรุณากรอกข้อมูลให้ครบทุกช่อง");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setFormError("กรุณากรอกอีเมลให้ถูกต้อง");
      return;
    }

    if (password.length < 6) {
      setPasswordError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      setFormError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }

    if (password !== confirmPassword) {
      setConfirmPasswordError("รหัสผ่านไม่ตรงกัน");
      setFormError("รหัสผ่านไม่ตรงกัน");
      return;
    }

    if (usernameStatus || emailStatus) {
      setFormError("กรุณาแก้ไขข้อมูลที่ไม่ถูกต้องก่อนลงทะเบียน");
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("user_name", username);
      formData.append("user_pass", password);
      formData.append("user_fname", fname);
      formData.append("user_lname", lname);
      formData.append("user_email", email);
      formData.append("user_phone", phone);
      if (selectedImage) formData.append("user_img", selectedImage);

      const response = await axios.post(`${config.apiUrl}/signup`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.status === 200 || response.status === 201) {
        await Swal.fire({
          title: "ลงทะเบียนสำเร็จ",
          text: "ยินดีต้อนรับ! คุณจะถูกนำไปยังหน้าแรก",
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });
        router.push("/signIn");
      }
    } catch (err: any) {
      const message = err.response?.data?.message || "ไม่สามารถลงทะเบียนได้";
      setFormError(message);
      Swal.fire({ icon: "error", title: "เกิดข้อผิดพลาด", text: message + err });
    } finally {
      setIsLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen grid place-items-center text-slate-600">
        กำลังตรวจสอบสถานะการเข้าสู่ระบบ…
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 font-prompt">
      <div className="fixed top-4 left-4">
        <Button variant="outline" asChild>
          <Link href="/">← กลับหน้าแรก</Link>
        </Button>
      </div>
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center text-blue-600">ลงทะเบียน</h1>
        <p className="text-center text-gray-600">กรุณากรอกข้อมูลเพื่อสร้างบัญชีใหม่</p>

        <form className="space-y-4" onSubmit={handleRegister}>
          {/* Username */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              Username
            </label>
            <Input
              id="username"
              className="border-blue-300 focus:ring-blue-500 focus:border-blue-500"
              type="text"
              placeholder="ชื่อผู้ใช้"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            {usernameStatus && <p className="text-sm text-red-500 mt-1">{usernameStatus}</p>}
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <Input
              id="password"
              className="border-blue-300 focus:ring-blue-500 focus:border-blue-500"
              type="password"
              placeholder="รหัสผ่าน"
              value={password}
              onChange={handlePasswordChange}
              required
            />
            {passwordError && <p className="text-sm text-red-500 mt-1">{passwordError}</p>}
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              Confirm Password
            </label>
            <Input
              id="confirmPassword"
              className="border-blue-300 focus:ring-blue-500 focus:border-blue-500"
              type="password"
              placeholder="ยืนยันรหัสผ่าน"
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
              required
            />
            {confirmPasswordError && <p className="text-sm text-red-500 mt-1">{confirmPasswordError}</p>}
          </div>

          {/* First Name */}
          <div>
            <label htmlFor="fname" className="block text-sm font-medium text-gray-700">
              First Name
            </label>
            <Input
              id="fname"
              className="border-blue-300 focus:ring-blue-500 focus:border-blue-500"
              type="text"
              placeholder="ชื่อจริง"
              value={fname}
              onChange={(e) => setFname(e.target.value)}
              required
            />
          </div>

          {/* Last Name */}
          <div>
            <label htmlFor="lname" className="block text-sm font-medium text-gray-700">
              Last Name
            </label>
            <Input
              id="lname"
              className="border-blue-300 focus:ring-blue-500 focus:border-blue-500"
              type="text"
              placeholder="นามสกุล"
              value={lname}
              onChange={(e) => setLname(e.target.value)}
              required
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <Input
              id="email"
              className="border-blue-300 focus:ring-blue-500 focus:border-blue-500"
              type="email"
              placeholder="อีเมล"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {emailStatus && <p className="text-sm text-red-500 mt-1">{emailStatus}</p>}
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              Tell
            </label>
            <Input
              id="phone"
              className="border-blue-300 focus:ring-blue-500 focus:border-blue-500"
              type="tel"
              pattern="[0-9]{10}"
              maxLength={10}
              placeholder="เบอร์โทรศัพท์"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
            />
          </div>

          {/* Image Upload */}
          <div>
            <label htmlFor="profilePicture" className="block text-sm font-medium text-gray-700">
              รูปโปรไฟล์ (ไม่บังคับ)
            </label>
            <Input
              id="profilePicture"
              className="border-blue-300 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
            />
            {selectedImage && (
              <p className="text-sm text-gray-500 mt-1">เลือกไฟล์: {selectedImage.name}</p>
            )}
          </div>

          {/* Form Error Message */}
          {formError && <p className="text-sm text-red-600">{formError}</p>}

          {/* Register Button */}
          <Button
            className="w-full text-white bg-blue-500 hover:bg-blue-600"
            type="submit"
            disabled={
              isLoading ||
              !username ||
              !password ||
              !confirmPassword ||
              !fname ||
              !lname ||
              !email ||
              !!usernameStatus ||
              !!emailStatus ||
              !!passwordError ||
              !!confirmPasswordError
            }
          >
            {isLoading ? "กำลังลงทะเบียน..." : "ลงทะเบียน"}
          </Button>
        </form>

        {/* Login Link */}
        <p className="text-center text-sm text-gray-600">
          มีบัญชีอยู่แล้ว?{" "}
          <Link href="/signIn" className="text-blue-600 hover:underline">
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </div>
  );
}
