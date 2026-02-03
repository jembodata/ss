"use client";

import { usePathname } from "next/navigation";
import {
  Header,
  HeaderName,
  HeaderNavigation,
  HeaderMenuItem
} from "@carbon/react";

const nav = [
  { href: "/", label: "Home" },
  { href: "/profiles", label: "Profiles" },
  { href: "/jobs", label: "Jobs" },
  { href: "/runs", label: "Runs" },
  { href: "/monitoring", label: "Monitoring" },
  { href: "/notifications", label: "Notifications" }
];

export default function AppHeader() {
  const pathname = usePathname();

  return (
    <Header aria-label="SSRururu">
      <HeaderName href="/" prefix="">
        SSRururu
      </HeaderName>
      <HeaderNavigation aria-label="Main">
        {nav.map((item) => (
          <HeaderMenuItem
            key={item.href}
            href={item.href}
            isCurrentPage={pathname === item.href}
          >
            {item.label}
          </HeaderMenuItem>
        ))}
      </HeaderNavigation>
    </Header>
  );
}
