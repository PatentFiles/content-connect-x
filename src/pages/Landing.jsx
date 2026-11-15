import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  ArrowRight,
} from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import MarketingFeatureShowcase from '@/components/marketing/MarketingFeatureShowcase';
import MobileRefreshPage from '@/components/ui-custom/MobileRefreshPage';

// CCCard is used in the How It Works section steps below

export default function Landing() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) return null;
      return base44.auth.me();
    },
  });

  const { data: verifiedMembers = [] } = useQuery({
    queryKey: ['verifiedMembersCount'],
    queryFn: () => base44.entities.VerificationRecord.filter({ status: 'approved' }),
  });

  const { data: completedCollabs = [] } = useQuery({
    queryKey: ['completedCollabsCount'],
    queryFn: () => base44.entities.Collaboration.filter({ status: 'completed' }),
  });

  const stats = [
    { value: verifiedMembers.length > 0 ? `${verifiedMembers.length}` : '0', label: 'Verified Members' },
    { value: completedCollabs.length > 0 ? `${completedCollabs.length}` : '0', label: 'Successful Collabs' },
    { value: '99%', label: 'Satisfaction Rate' },
    { value: '24/7', label: 'Support' },
  ];

  // Redirect authenticated users to Discovery
  React.useEffect(() => {
    if (user) {
      window.location.href = createPageUrl('Discovery');
    }
  }, [user]);

  // Don't render landing page if user is authenticated
  if (user) return null;

  return (
    <MobileRefreshPage>
    <div className="min-h-screen bg-cc-bg">
      {/* Hero Section */}
      <section className="bg-[#0B0F14]">
        <img
          src="/content_conect_hero.png"
          alt="Content Connect X creator collaboration banner"
          className="block w-full h-auto object-contain"
        />

        <div className="px-4 py-10 sm:py-12 md:py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <CCButton
              variant="primary"
              size="xl"
              iconRight={ArrowRight}
              onClick={() => base44.auth.redirectToLogin(createPageUrl('Discovery'))}
            >
              Get Started Free
            </CCButton>
            <Link to={createPageUrl('HowItWorks')}>
              <CCButton variant="outline" size="xl">
                See How It Works
              </CCButton>
            </Link>
          </motion.div>

          {/* Stats - Hidden until 1000 verified members */}
          {verifiedMembers.length >= 1000 && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 max-w-6xl mx-auto"
            >
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-white">{stat.value}</div>
                  <div className="text-sm text-white/70">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </section>

      {/* Features Section — driven by live feature flags */}
      <section className="relative overflow-hidden bg-cc-surface px-4 py-20 sm:py-24">
        <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-[min(90vw,900px)] -translate-x-1/2 rounded-full bg-[#4F8CFF]/10 blur-3xl" />
        <div className="relative mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto mb-12 max-w-3xl text-center sm:mb-16"
          >
            <span className="mb-4 inline-flex rounded-full border border-[#4F8CFF]/30 bg-[#4F8CFF]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#4F8CFF]">
              Built for better creative work
            </span>
            <h2 className="mb-5 text-3xl font-bold leading-tight cc-text-fix-primary sm:text-4xl md:text-5xl">
              Everything You Need to Collaborate Safely
            </h2>
            <p className="mx-auto max-w-2xl text-base leading-7 cc-text-fix-secondary sm:text-lg">
              Built specifically for content professionals. Every feature is designed to help you create with more trust, clarity, and confidence.
            </p>
          </motion.div>
          <MarketingFeatureShowcase onlyPage="Landing" />
        </div>
      </section>

      {/* How It Works Preview */}
      <section className="bg-cc-bg px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto mb-12 max-w-3xl text-center sm:mb-16"
          >
            <span className="mb-4 inline-flex rounded-full border border-[#FF2DAA]/30 bg-[#FF2DAA]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#FF5FBD]">
              Your path to collaboration
            </span>
            <h2 className="mb-5 text-3xl font-bold leading-tight cc-text-fix-primary sm:text-4xl md:text-5xl">
              Simple, Safe, Professional
            </h2>
            <p className="mx-auto max-w-2xl text-base leading-7 cc-text-fix-secondary sm:text-lg">
              Get started in minutes. Our verification process helps create a safer, more dependable community.
            </p>
          </motion.div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { step: 1, title: 'Verify', desc: 'Complete identity verification' },
              { step: 2, title: 'Subscribe', desc: 'Choose your plan' },
              { step: 3, title: 'Discover', desc: 'Find collaborators' },
              { step: 4, title: 'Negotiate', desc: 'Negotiate Collaborations' },
              { step: 5, title: 'Sign', desc: 'E-sign contracts' },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative"
              >
                <CCCard padding="lg" className="group h-full text-center hover:-translate-y-1 hover:border-[#4F8CFF]/60 hover:shadow-[0_16px_40px_rgba(79,140,255,0.1)]">
                  <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4F8CFF] to-[#FF2DAA] text-lg font-bold text-white shadow-lg shadow-[#4F8CFF]/20 transition-transform duration-300 group-hover:scale-110">
                    {item.step}
                  </div>
                  <h4 className="mb-2 font-semibold cc-text-fix-primary">{item.title}</h4>
                  <p className="text-sm leading-6 cc-text-fix-muted">{item.desc}</p>
                </CCCard>
                {i < 4 && (
                  <div className="pointer-events-none absolute -right-4 top-1/2 hidden -translate-y-1/2 text-[#4F8CFF]/60 lg:block">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-20 sm:py-24">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-[#4F8CFF]/30 bg-gradient-to-br from-[#4F8CFF]/20 via-cc-surface to-[#FF2DAA]/20 px-6 py-14 text-center shadow-2xl shadow-[#4F8CFF]/10 sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[#FF2DAA]/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-[#4F8CFF]/20 blur-3xl" />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <span className="mb-4 inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
              Start creating together
            </span>
            <h2 className="mb-4 text-3xl font-bold leading-tight text-white sm:text-4xl md:text-5xl">
              Ready to Join the Community?
            </h2>
            <p className="mx-auto mb-8 max-w-2xl text-base leading-7 text-white/75 sm:text-lg">
              Start your journey today. Connect with verified professionals and take your collaborations to the next level.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <CCButton 
                variant="primary" 
                size="xl" 
                iconRight={ArrowRight}
                onClick={() => base44.auth.redirectToLogin(createPageUrl('Discovery'))}
              >
                Create Free Account
              </CCButton>
              <Link to={createPageUrl('Pricing')}>
                <CCButton variant="outline" size="xl">
                  View Pricing
                </CCButton>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-cc-border">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center md:text-left">
              <div className="flex items-center gap-2 mb-4 justify-center md:justify-start">
                <img
                  src="/content_connect_logo.png"
                  alt="Content Connect X logo"
                  className="w-10 h-10 rounded-xl object-cover"
                />
                <span className="font-semibold cc-text-fix-primary">Content Connect X</span>
              </div>
              <p className="text-sm cc-text-fix-muted">
                The verified collaboration network for professional content creators.
              </p>
            </div>
            <div className="text-center md:text-left">
              <h4 className="font-semibold cc-text-fix-primary mb-4">Platform</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to={createPageUrl('HowItWorks')} className="cc-text-fix-secondary hover:cc-text-fix-primary">How it Works</Link></li>
                <li><Link to={createPageUrl('Pricing')} className="cc-text-fix-secondary hover:cc-text-fix-primary">Pricing</Link></li>
                <li><Link to={createPageUrl('FAQ')} className="cc-text-fix-secondary hover:cc-text-fix-primary">FAQ</Link></li>
              </ul>
            </div>
            <div className="text-center md:text-left">
              <h4 className="font-semibold cc-text-fix-primary mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to={createPageUrl('Terms')} className="cc-text-fix-secondary hover:cc-text-fix-primary">Terms of Service</Link></li>
                <li><Link to={createPageUrl('Privacy')} className="cc-text-fix-secondary hover:cc-text-fix-primary">Privacy Policy</Link></li>
              </ul>
            </div>
            <div className="text-center md:text-left">
              <h4 className="font-semibold cc-text-fix-primary mb-4">Support</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to={createPageUrl('Contact')} className="cc-text-fix-secondary hover:cc-text-fix-primary">Contact Us</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-cc-border text-center text-sm cc-text-fix-muted">
            © {new Date().getFullYear()} Content Connect X. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
    </MobileRefreshPage>
  );
}