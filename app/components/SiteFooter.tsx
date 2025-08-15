"use client";
import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="bg-neutral-900 text-neutral-200 mt-0">
      <div className="container mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <Link href="#" className="hover:text-white">Service</Link>
          <Link href="#" className="hover:text-white">About Us</Link>
          <Link href="#" className="hover:text-white">Contact Us</Link>
          <Link href="#" className="hover:text-white">FAQs</Link>
          <Link href="#" className="hover:text-white">Sign in</Link>
          <span className="ml-auto text-neutral-400">SaiLom © {new Date().getFullYear()} . All rights reserved</span>
        </div>
        <div className="mt-4 flex items-center gap-4">
          <a href="#" aria-label="facebook" className="hover:text-white"></a>
          <a href="#" aria-label="twitter" className="hover:text-white"></a>
          <a href="#" aria-label="instagram" className="hover:text-white"></a>
        </div>
      </div>
    </footer>
  );
}
