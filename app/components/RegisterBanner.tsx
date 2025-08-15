"use client";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function RegisterBanner() {
  return (
    <section className="relative mt-12">
      <div className="absolute inset-0 -z-10">
        <Image
          src="/images/register-bg.jpg"
          alt="Register Banner"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black/55" />
      </div>

      <div className="container mx-auto max-w-6xl px-4 py-16 text-center text-white">
        <h3 className="text-2xl sm:text-3xl font-bold">
          REGISTER FOR <span className="text-indigo-300">FREE</span>
        </h3>
        <p className="mt-2 text-white/90">
          Register with us and win amazing discount points on <span className="text-indigo-300">SaiLom</span>
        </p>
        <Button className="mt-4 bg-indigo-600 hover:bg-indigo-700">Register</Button>
      </div>
    </section>
  );
}
