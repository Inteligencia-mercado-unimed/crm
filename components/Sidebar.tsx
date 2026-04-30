'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  ShieldCheck, 
  BarChart3, 
  Settings, 
  LogOut,
  Plus,
  Shield
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export function Sidebar() {
  const pathname = usePathname();
  const { signOut, profile } = useAuth();

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
    { icon: FileText, label: 'Propostas', href: '/proposals' },
    { icon: Users, label: 'Clientes', href: '/clients' },
    { icon: ShieldCheck, label: 'Planos', href: '/plans' },
    { icon: BarChart3, label: 'Analytics', href: '/analytics' },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0 shrink-0 no-print">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="bg-[#00995D] p-1.5 rounded-lg text-white">
            <Shield size={20} />
          </div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">CRM Admin</h1>
        </div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
          Insurance Lead
        </p>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto pt-2">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold text-sm ${
                isActive 
                  ? 'bg-[#00995D]/10 text-[#00995D]' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <item.icon size={20} className={isActive ? 'text-[#00995D]' : 'text-slate-400'} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 space-y-4">
        <Link 
          href="/" 
          className="flex items-center justify-center gap-2 w-full bg-[#00995D] hover:bg-[#007D4C] text-white py-3.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-[#00995D]/20 active:scale-95"
        >
          <Plus size={18} />
          Nova Proposta
        </Link>

        <div className="pt-4 border-t border-slate-100 space-y-1">
          {profile && (
            <div className="px-4 py-3 flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                {profile.full_name?.substring(0, 2).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-slate-700 truncate">{profile.full_name}</p>
                <p className="text-[10px] text-slate-400 uppercase font-bold">{profile.role}</p>
              </div>
            </div>
          )}
          
          <Link
            href="/settings"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all font-semibold text-sm"
          >
            <Settings size={20} className="text-slate-400" />
            Configurações
          </Link>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all font-semibold text-sm w-full text-left"
          >
            <LogOut size={20} className="text-slate-400" />
            Sair
          </button>
        </div>
      </div>
    </aside>
  );
}
