import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { AiDrawer } from "@/components/walix/AiDrawer";

export function AppLayout() {
  return (
    <div className="min-h-screen w-full flex bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 px-4 md:px-6 py-6 pb-24 md:pb-6 animate-fade-in">
          <Outlet />
        </main>
      </div>
      <BottomNav />
      <AiDrawer />
    </div>
  );
}