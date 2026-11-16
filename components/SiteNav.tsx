"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { TOOLS } from "@/lib/tools";
import { BRAND } from "@/lib/config";

export default function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile menu on navigation and on Escape
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) => pathname === href || pathname.endsWith(href);

  return (
    <header className={`top${open ? " is-open" : ""}`}>
      <div className="wrap top-bar">
        <Link href="/" className="logo" aria-label={`${BRAND.name} ${BRAND.byline}, all tools`}>
          <Image
            src="/logo-white.png"
            alt={`${BRAND.name} ${BRAND.byline}`}
            width={480}
            height={193}
            priority
            unoptimized
            style={{ height: 46, width: "auto", display: "block" }}
          />
        </Link>

        <nav className="nav-desktop" aria-label="Tools">
          {TOOLS.map((t) => (
            <Link key={t.href} href={t.href} className="nav-link" aria-current={isActive(t.href) ? "page" : undefined}>
              {t.title}
            </Link>
          ))}
          <a className="nav-site" href="https://www.theideafarm.net" target="_top">
            theideafarm.net <span aria-hidden>↗</span>
          </a>
        </nav>

        <button
          type="button"
          className="burger"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <div id="mobile-menu" className="mobile-menu" hidden={!open}>
        <div className="wrap">
          <p className="mobile-label">Free tools</p>
          <ul>
            {TOOLS.map((t) => (
              <li key={t.href}>
                <Link href={t.href} className="mobile-item" aria-current={isActive(t.href) ? "page" : undefined}>
                  <span className="mobile-icon" aria-hidden>
                    {t.icon}
                  </span>
                  <span>
                    <span className="mobile-title">{t.title}</span>
                    <span className="mobile-short">{t.short}</span>
                  </span>
                  <span className="mobile-arrow" aria-hidden>
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mobile-foot">
            <Link href="/">All tools</Link>
            <a href="https://www.theideafarm.net" target="_top">
              Visit theideafarm.net ↗
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
