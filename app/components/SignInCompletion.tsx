"use client";
// app/components/SignInCompletion.tsx
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import Swal from "sweetalert2";
import * as React from "react";

interface SignInCompletionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missingFields: string[];
  submitting?: boolean;                 // ✅ เพิ่ม
  usernameStatus?: string;              // ✅ เพิ่ม
  emailStatus?: string;                 // ✅ เพิ่ม
  passwordError?: string;               // ✅ เพิ่ม
  confirmPasswordError?: string;        // ✅ เพิ่ม
  profileForm: {
    user_name: string;
    user_pass: string;
    confirm_pass: string;
    user_fname: string;
    user_lname: string;
    user_email: string;
    user_phone: string;
  };
  onProfileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onProfileSubmit: (e: React.FormEvent) => Promise<void>;
}

export default function SignInCompletion({
  open,
  onOpenChange,
  missingFields,
  submitting = false,
  usernameStatus = "",
  emailStatus = "",
  passwordError = "",
  confirmPasswordError = "",
  profileForm,
  onProfileChange,
  onProfileSubmit,
}: SignInCompletionProps) {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (missingFields.includes("user_pass")) {
      if (!profileForm.user_pass || profileForm.user_pass.length < 6) {
        await Swal.fire({
          icon: "error",
          title: "รหัสผ่านไม่ถูกต้อง",
          text: "กรุณากรอกรหัสผ่านอย่างน้อย 6 ตัวอักษร",
          showConfirmButton: false,
          timer: 1500,
        });
        return;
      }
    }

    if (
      (profileForm.user_pass?.length ?? 0) > 0 &&
      profileForm.user_pass !== profileForm.confirm_pass
    ) {
      await Swal.fire({
        icon: "error",
        title: "รหัสผ่านไม่ตรงกัน",
        text: "กรุณายืนยันรหัสผ่านให้ตรงกัน",
        showConfirmButton: false,
        timer: 1500,
      });
      return;
    }

    if (
      missingFields.includes("user_phone") &&
      !/^0[0-9]{9}$/.test(profileForm.user_phone)
    ) {
      await Swal.fire({
        icon: "error",
        title: "เบอร์โทรศัพท์ไม่ถูกต้อง",
        text: "กรุณากรอกเบอร์โทรศัพท์ที่ถูกต้อง (เช่น 0812345678)",
        showConfirmButton: true,
      });
      return;
    }

    await onProfileSubmit(e);
  };

  const show = (field: string) =>
    missingFields.length === 0 || missingFields.includes(field);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-white shadow-lg rounded-xl">
        <DialogHeader>
          <DialogTitle>กรอกข้อมูลโปรไฟล์</DialogTitle>
          <DialogDescription>
            กรุณากรอกข้อมูลที่จำเป็นเพื่อดำเนินการต่อ
          </DialogDescription>
        </DialogHeader>

        {missingFields.length > 0 && (
          <div className="text-xs text-red-600">
            ต้องกรอกเพิ่มเติม: {missingFields.join(", ")}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* อีเมล (ล็อกแก้ไข) */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              อีเมล
            </label>
            <Input
              type="email"
              name="user_email"
              value={profileForm.user_email || ""}
              readOnly
              className="border-gray-300 bg-gray-100 cursor-not-allowed"
              aria-invalid={!!emailStatus}
            />
            {emailStatus && (
              <p className="mt-1 text-xs text-red-600">{emailStatus}</p>
            )}
          </div>

          {show("user_name") && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                ชื่อผู้ใช้
              </label>
              <Input
                type="text"
                name="user_name"
                value={profileForm.user_name || ""}
                onChange={onProfileChange}
                placeholder="ชื่อผู้ใช้"
                required
                className="border-blue-300 focus:ring-blue-500 focus:border-blue-500"
                aria-invalid={!!usernameStatus}
              />
              {usernameStatus && (
                <p className="mt-1 text-xs text-red-600">{usernameStatus}</p>
              )}
            </div>
          )}

          {show("user_pass") && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  รหัสผ่าน
                </label>
                <Input
                  type="password"
                  name="user_pass"
                  value={profileForm.user_pass || ""}
                  onChange={onProfileChange}
                  placeholder="รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)"
                  required
                  className="border-blue-300 focus:ring-blue-500 focus:border-blue-500"
                  aria-invalid={!!passwordError}
                />
                {passwordError && (
                  <p className="mt-1 text-xs text-red-600">{passwordError}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  ยืนยันรหัสผ่าน
                </label>
                <Input
                  type="password"
                  name="confirm_pass"
                  value={profileForm.confirm_pass || ""}
                  onChange={onProfileChange}
                  placeholder="ยืนยันรหัสผ่าน"
                  required
                  className="border-blue-300 focus:ring-blue-500 focus:border-blue-500"
                  aria-invalid={!!confirmPasswordError}
                />
                {confirmPasswordError && (
                  <p className="mt-1 text-xs text-red-600">
                    {confirmPasswordError}
                  </p>
                )}
              </div>
            </>
          )}

          {show("user_fname") && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                ชื่อจริง
              </label>
              <Input
                type="text"
                name="user_fname"
                value={profileForm.user_fname || ""}
                onChange={onProfileChange}
                placeholder="ชื่อจริง"
                required
                className="border-blue-300 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}

          {show("user_lname") && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                นามสกุล
              </label>
              <Input
                type="text"
                name="user_lname"
                value={profileForm.user_lname || ""}
                onChange={onProfileChange}
                placeholder="นามสกุล"
                required
                className="border-blue-300 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}

          {show("user_phone") && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                เบอร์โทรศัพท์
              </label>
              <Input
                type="text"
                name="user_phone"
                value={profileForm.user_phone || ""}
                onChange={onProfileChange}
                placeholder="เบอร์โทรศัพท์"
                required
                className="border-blue-300 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium"
            disabled={submitting}
          >
            {submitting ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
