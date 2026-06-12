'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Spinner from '@/components/ui/Spinner';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { CheckSquare, Zap, Shield, Search } from 'lucide-react';

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isAuthenticated) return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] px-4 text-center">
      <div className="max-w-2xl">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-2xl bg-primary-600 flex items-center justify-center shadow-lg">
            <CheckSquare className="w-10 h-10 text-white" />
          </div>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white mb-4">
          Get things done with <span className="text-primary-600">TaskFlow</span>
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 max-w-lg mx-auto">
          A full-featured task manager with real-time updates, file attachments, priority tracking, and more.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
          <Link href="/auth/signup">
            <Button size="lg">Get Started Free</Button>
          </Link>
          <Link href="/auth/login">
            <Button size="lg" variant="outline">Sign in</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
          {[
            { icon: Zap, title: 'Real-time Updates', desc: 'Task changes sync instantly via WebSockets' },
            { icon: Shield, title: 'Secure Auth', desc: 'JWT authentication with bcrypt password hashing' },
            { icon: Search, title: 'Search & Filter', desc: 'Find tasks fast with search, filter, and sort' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
              <Icon className="w-6 h-6 text-primary-500 mb-3" />
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1">{title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
