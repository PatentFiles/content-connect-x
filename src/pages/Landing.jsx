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
      <section className="py-20 px-4 bg-cc-surface">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold cc-text-fix-primary mb-4">
              Everything You Need to Collaborate Safely
            </h2>
            <p className="cc-text-fix-secondary max-w-2xl mx-auto">
              Built specifically for content professionals. Every feature designed with your safety and success in mind.
            </p>
          </motion.div>
          <MarketingFeatureShowcase onlyPage="Landing" />
        </div>
      </section>

      {/* How It Works Preview */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold cc-text-fix-primary mb-4">
              Simple, Safe, Professional
            </h2>
            <p className="cc-text-fix-secondary max-w-2xl mx-auto">
              Get started in minutes. Our verification process keeps the community safe.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-5 gap-4">
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
                <CCCard padding="md" className="text-center h-full">
                  <div className="w-10 h-10 rounded-full bg-[#4F8CFF] text-white font-bold flex items-center justify-center mx-auto mb-3">
                    {item.step}
                  </div>
                  <h4 className="font-semibold cc-text-fix-primary mb-1">{item.title}</h4>
                  <p className="text-xs cc-text-fix-muted">{item.desc}</p>
                </CCCard>
                {i < 4 && (
                  <div className="hidden md:block absolute top-1/2 -right-2 w-4 cc-text-fix-muted">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-[#4F8CFF]/20 to-[#FF2DAA]/20">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold cc-text-fix-primary mb-4">
              Ready to Join the Community?
            </h2>
            <p className="cc-text-fix-secondary mb-8 max-w-2xl mx-auto">
              Start your journey today. Connect with verified professionals and take your collaborations to the next level.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
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
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4F8CFF] to-[#FF2DAA] flex items-center justify-center">
                  <span className="text-white font-bold text-sm">OCX</span>
                </div>
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