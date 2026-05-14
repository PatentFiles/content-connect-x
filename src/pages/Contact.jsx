import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';
import { Send, CheckCircle2, ArrowLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import CCButton from '@/components/ui-custom/CCButton';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required.';
    if (!form.email.trim()) e.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email.';
    if (!form.message.trim()) e.message = 'Message is required.';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      await base44.integrations.Core.SendEmail({
        to: 'support@onlycollabsx.com',
        subject: `Contact Form: ${form.name}`,
        body: `Name: ${form.name}\nEmail: ${form.email}\nPhone: ${form.phone || 'N/A'}\n\nMessage:\n${form.message}`,
      });
      setSubmitted(true);
    } catch {
      setErrors({ submit: 'Something went wrong. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const field = (id, label, required, extra = {}) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium cc-text-fix-primary mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        id={id}
        type={extra.type || 'text'}
        value={form[id]}
        onChange={(e) => setForm({ ...form, [id]: e.target.value })}
        placeholder={extra.placeholder || ''}
        className="w-full px-4 py-2.5 rounded-lg border text-sm transition-colors
          bg-[var(--cc-surface)] border-[var(--cc-border)] text-[var(--cc-text-primary)]
          placeholder:text-[var(--cc-text-muted)]
          focus:outline-none focus:ring-2 focus:ring-[var(--cc-blue)]/40 focus:border-[var(--cc-blue)]"
      />
      {errors[id] && <p className="mt-1 text-xs text-red-500">{errors[id]}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-cc-bg py-20 px-4">
      <div className="max-w-lg mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          {/* Back link */}
          <Link to={createPageUrl('Landing')} className="inline-flex items-center gap-2 text-sm cc-text-fix-secondary hover:cc-text-fix-primary mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>

          {/* Card */}
          <div className="rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-8 shadow-sm">
            {submitted ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-14 h-14 mx-auto mb-4" style={{ color: 'var(--cc-blue)' }} />
                <h2 className="text-2xl font-bold cc-text-fix-primary mb-2">Message Sent!</h2>
                <p className="cc-text-fix-secondary mb-6">Thanks for reaching out. We'll get back to you as soon as possible.</p>
                <Link to={createPageUrl('Landing')}>
                  <CCButton variant="primary">Back to Home</CCButton>
                </Link>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold cc-text-fix-primary mb-1">Contact Us</h1>
                <p className="cc-text-fix-secondary text-sm mb-6">Have a question or need help? Send us a message.</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {field('name', 'Full Name', true, { placeholder: 'Jane Doe' })}
                  {field('email', 'Email Address', true, { type: 'email', placeholder: 'jane@example.com' })}

                  {/* Phone — optional */}
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium cc-text-fix-primary mb-1">
                      Phone Number <span className="cc-text-fix-muted text-xs font-normal">(optional)</span>
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="+1 (555) 000-0000"
                      className="w-full px-4 py-2.5 rounded-lg border text-sm transition-colors
                        bg-[var(--cc-surface)] border-[var(--cc-border)] text-[var(--cc-text-primary)]
                        placeholder:text-[var(--cc-text-muted)]
                        focus:outline-none focus:ring-2 focus:ring-[var(--cc-blue)]/40 focus:border-[var(--cc-blue)]"
                    />
                  </div>

                  {/* Message */}
                  <div>
                    <label htmlFor="message" className="block text-sm font-medium cc-text-fix-primary mb-1">
                      Message <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="message"
                      rows={5}
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      placeholder="Tell us how we can help..."
                      className="w-full px-4 py-2.5 rounded-lg border text-sm transition-colors resize-none
                        bg-[var(--cc-surface)] border-[var(--cc-border)] text-[var(--cc-text-primary)]
                        placeholder:text-[var(--cc-text-muted)]
                        focus:outline-none focus:ring-2 focus:ring-[var(--cc-blue)]/40 focus:border-[var(--cc-blue)]"
                    />
                    {errors.message && <p className="mt-1 text-xs text-red-500">{errors.message}</p>}
                  </div>

                  {errors.submit && <p className="text-sm text-red-500">{errors.submit}</p>}

                  <CCButton type="submit" variant="primary" size="lg" fullWidth loading={loading} icon={Send}>
                    Send Message
                  </CCButton>
                </form>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}