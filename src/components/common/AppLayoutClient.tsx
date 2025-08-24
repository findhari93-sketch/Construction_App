"use client";

import * as React from "react";
import AppSidebar, { defaultMenu } from "@/components/common/AppSidebar";
import AppShell from "@/components/common/AppShell";

export default function AppLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <>
      <AppSidebar
        title="Construction Manager"
        logo={<img src="/favicon.ico" alt="logo" height={24} />}
        user={{ name: "Hari Babu", role: "Admin" }}
        items={defaultMenu}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
      />
      <AppShell collapsed={collapsed}>{children}</AppShell>
    </>
  );
}
