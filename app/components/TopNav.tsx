"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function TopNav() {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b">
      <nav className="container mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button aria-label="menu" className="lg:hidden">
            <svg width="24" height="24" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
          <Link href="/" className="text-lg font-semibold">
            <span className="text-gray-900">Welcome to </span>
            <span className="text-indigo-600">SaiLom</span>
          </Link>
        </div>

        <ul className="hidden lg:flex items-center gap-6 text-sm">
          <li><Link href="/" className="text-gray-700 hover:text-indigo-600">Home</Link></li>
          <li><Link href="/table" className="text-gray-700 hover:text-indigo-600">Table</Link></li>
          <li><Link href="/menu" className="text-gray-700 hover:text-indigo-600">Menu</Link></li>
          <li><Link href="http://localhost:3000/backoffice/dashboard" target="_blank" rel="noopener noreferrer">Dashboard</Link>
</li>
        </ul>

        <div className="flex items-center gap-2">
          <Button variant="outline" className="hidden sm:inline-flex">Sign in</Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700">Sign Up</Button>
        </div>
      </nav>
    </header>
  );
}
