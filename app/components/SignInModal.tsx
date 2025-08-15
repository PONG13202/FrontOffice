"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Swal from "sweetalert2"; // Ensure Swal is imported if used directly here

interface SignInModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // missingFields: string[]; // Removed as validation is now handled by specific status props
  profileForm: {
    user_name: string;
    user_pass: string;
    confirm_pass: string; // Added for password confirmation
    user_fname: string;
    user_lname: string;
    user_email: string;
    user_phone: string;
  };
  onProfileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onProfileSubmit: (e: React.FormEvent) => Promise<void>;
  usernameStatus: string; // Status for username availability
  emailStatus: string;     // Status for email availability
  passwordError: string;   // Error message for password validation
  confirmPasswordError: string; // Error message for confirm password validation
}

export default function ProfileCompletionModal({
  open,
  onOpenChange,
  // missingFields, // Removed from destructuring
  profileForm,
  onProfileChange,
  onProfileSubmit,
  usernameStatus,
  emailStatus,
  passwordError,
  confirmPasswordError,
}: SignInModalProps) {

  // The handleSubmit logic is now primarily handled by onProfileSubmit in LoginPage
  // This local handleSubmit will perform basic client-side validation before calling the parent's submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic client-side validation before sending to parent handler
    if (!profileForm.user_name || !profileForm.user_pass || !profileForm.confirm_pass || !profileForm.user_fname || !profileForm.user_lname || !profileForm.user_email) {
      await Swal.fire({
        icon: "error",
        title: "ข้อมูลไม่ครบถ้วน",
        text: "กรุณากรอกข้อมูลที่จำเป็นให้ครบทุกช่อง",
        showConfirmButton: false,
        timer: 1500,
      });
      return;
    }

    if (passwordError || confirmPasswordError || usernameStatus || emailStatus) {
      await Swal.fire({
        icon: "error",
        title: "ข้อมูลไม่ถูกต้อง",
        text: "กรุณาแก้ไขข้อมูลที่มีข้อผิดพลาดก่อนบันทึก",
        showConfirmButton: false,
        timer: 2000,
      });
      return;
    }

    // If all client-side validations pass, call the parent's submit handler
    await onProfileSubmit(e);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] font-prompt bg-white shadow-lg rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold text-blue-600">
            กรอกข้อมูลโปรไฟล์ให้สมบูรณ์
          </DialogTitle>
          <DialogDescription className="text-center text-gray-600">
            กรุณากรอกข้อมูลที่จำเป็นเพื่อเข้าสู่ระบบ
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          {/* Email (Readonly if pre-filled) */}
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="user_email" className="text-right text-sm font-medium text-gray-700">
              อีเมล
            </label>
            <Input
              id="user_email"
              name="user_email"
              type="email"
              value={profileForm.user_email}
              onChange={onProfileChange}
              className="col-span-3 border-blue-300 focus:ring-blue-500 focus:border-blue-500"
              readOnly={!!profileForm.user_email} // Make readonly if email is already present
              required
            />
            {emailStatus && (
              <p className="col-span-4 text-sm text-red-500 text-right mt-1">{emailStatus}</p>
            )}
          </div>

          {/* Username */}
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="user_name" className="text-right text-sm font-medium text-gray-700">
              ชื่อผู้ใช้
            </label>
            <Input
              id="user_name"
              name="user_name"
              type="text"
              value={profileForm.user_name}
              onChange={onProfileChange}
              className="col-span-3 border-blue-300 focus:ring-blue-500 focus:border-blue-500"
              placeholder="ชื่อผู้ใช้"
              required
            />
            {usernameStatus && (
              <p className="col-span-4 text-sm text-red-500 text-right mt-1">{usernameStatus}</p>
            )}
          </div>

          {/* Password */}
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="user_pass" className="text-right text-sm font-medium text-gray-700">
              รหัสผ่าน
            </label>
            <Input
              id="user_pass"
              name="user_pass"
              type="password"
              value={profileForm.user_pass}
              onChange={onProfileChange}
              className="col-span-3 border-blue-300 focus:ring-blue-500 focus:border-blue-500"
              placeholder="รหัสผ่าน"
              required
            />
            {passwordError && (
              <p className="col-span-4 text-sm text-red-500 text-right mt-1">{passwordError}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="confirm_pass" className="text-right text-sm font-medium text-gray-700">
              ยืนยันรหัสผ่าน
            </label>
            <Input
              id="confirm_pass"
              name="confirm_pass"
              type="password"
              value={profileForm.confirm_pass}
              onChange={onProfileChange}
              className="col-span-3 border-blue-300 focus:ring-blue-500 focus:border-blue-500"
              placeholder="ยืนยันรหัสผ่าน"
              required
            />
            {confirmPasswordError && (
              <p className="col-span-4 text-sm text-red-500 text-right mt-1">{confirmPasswordError}</p>
            )}
          </div>

          {/* First Name */}
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="user_fname" className="text-right text-sm font-medium text-gray-700">
              ชื่อจริง
            </label>
            <Input
              id="user_fname"
              name="user_fname"
              type="text"
              value={profileForm.user_fname}
              onChange={onProfileChange}
              className="col-span-3 border-blue-300 focus:ring-blue-500 focus:border-blue-500"
              placeholder="ชื่อจริง"
              required
            />
          </div>

          {/* Last Name */}
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="user_lname" className="text-right text-sm font-medium text-gray-700">
              นามสกุล
            </label>
            <Input
              id="user_lname"
              name="user_lname"
              type="text"
              value={profileForm.user_lname}
              onChange={onProfileChange}
              className="col-span-3 border-blue-300 focus:ring-blue-500 focus:border-blue-500"
              placeholder="นามสกุล"
              required
            />
          </div>

          {/* Phone */}
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="user_phone" className="text-right text-sm font-medium text-gray-700">
              เบอร์โทรศัพท์
            </label>
            <Input
              id="user_phone"
              name="user_phone"
              type="tel"
              pattern="[0-9]{10}"
              maxLength={10}
              value={profileForm.user_phone}
              onChange={onProfileChange}
              className="col-span-3 border-blue-300 focus:ring-blue-500 focus:border-blue-500"
              placeholder="เบอร์โทรศัพท์ (ไม่บังคับ)"
            />
          </div>

          {/* Image Upload */}
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="user_img" className="text-right text-sm font-medium text-gray-700">
              รูปโปรไฟล์
            </label>
            <Input
              id="user_img"
              name="user_img"
              type="file"
              accept="image/*"
              onChange={onProfileChange}
              className="col-span-3 border-blue-300 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium mt-4"
            disabled={
                !!usernameStatus ||
                !!emailStatus ||
                !!passwordError ||
                !!confirmPasswordError ||
                !profileForm.user_name ||
                !profileForm.user_pass ||
                !profileForm.confirm_pass ||
                !profileForm.user_fname ||
                !profileForm.user_lname ||
                !profileForm.user_email
            }
          >
            บันทึกข้อมูลและเข้าสู่ระบบ
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
