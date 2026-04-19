import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { format, subDays } from 'date-fns';
import { Eye, Image, Heart, TrendingUp } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import { CCSkeletonLoader } from '@/components/ui-custom/CCLoading';

function buildWeeklyBuckets(views) {
  const now = new Date();
  const buckets = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (7 - i) * 7);
    return { week: format(d, 'MMM d'), cutoff: d, visits: 0, gallery: 0 };
  });

  views.forEach(v => {
    const d = new Date(v.viewed_date);
    for (let i = buckets.length - 1; i >= 0; i--) {
      if (d >= buckets[i].cutoff) {
        if (v.view_type === 'gallery') buckets[i].gallery++;
        else buckets[i].visits++;
        break;
      }
    }
  });
  return buckets;
}

const tooltipStyle = {
  contentStyle: { background: '#151D2B', border: '1px solid #263248', borderRadius: 8, color: '#E8EEF9', fontSize: 12 },
  labelStyle: { color: '#9AA6BC' },
};

export default function ProfileAnalytics({ userId }) {
  const { data: views = [], isLoading } = useQuery({
    queryKey: ['profileViews', userId],
    queryFn: () => base44.entities.ProfileView.filter({ profile_owner_id: userId }),
    enabled: !!userId,
  });

  const { data: galleries = [] } = useQuery({
    queryKey: ['myGalleries', userId],
    queryFn: () => base44.entities.Gallery.filter({ user_id: userId }),
    enabled: !!userId,
  });

  const { data: allFavorites = [] } = useQuery({
    queryKey: ['allFavorites'],
    queryFn: () => base44.entities.Favorite.list(),
    enabled: !!userId,
  });

  const totalVisits = views.filter(v => v.view_type !== 'gallery').length;
  const totalGalleryViews = views.filter(v => v.view_type === 'gallery').length;
  const totalItems = galleries.reduce((s, g) => s + (g.items?.length || 0), 0);
  const savedCount = allFavorites.filter(f => f.items?.some(i => i.user_id === userId)).length;

  const chartData = useMemo(() => buildWeeklyBuckets(views), [views]);

  const stats = [
    { label: 'Profile Visits', value: totalVisits, icon: Eye, color: '#4F8CFF' },
    { label: 'Gallery Views', value: totalGalleryViews, icon: Image, color: '#FF2DAA' },
    { label: 'Gallery Items', value: totalItems, icon: TrendingUp, color: '#22C55E' },
    { label: 'Saved By', value: savedCount, icon: Heart, color: '#F59E0B' },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <CCSkeletonLoader key={i} className="h-20 rounded-xl" />)}
        </div>
        <CCSkeletonLoader className="h-56 rounded-xl" />
        <CCSkeletonLoader className="h-56 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(s => (
          <CCCard key={s.label} padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: s.color + '20' }}>
                <s.icon className="w-5 h-5" style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-xl font-bold text-[#E8EEF9]">{s.value}</p>
                <p className="text-xs text-[#6B7A94] leading-tight">{s.label}</p>
              </div>
            </div>
          </CCCard>
        ))}
      </div>

      {/* Profile Visits Line Chart */}
      <CCCard padding="lg">
        <h3 className="text-base font-semibold text-[#E8EEF9] mb-4">Profile Visits — Last 8 Weeks</h3>
        {totalVisits === 0 ? (
          <p className="text-center text-sm text-[#6B7A94] py-8">No visit data yet. Data is tracked when others view your profile.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#263248" />
              <XAxis dataKey="week" tick={{ fill: '#6B7A94', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6B7A94', fontSize: 11 }} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Line type="monotone" dataKey="visits" stroke="#4F8CFF" strokeWidth={2}
                dot={{ fill: '#4F8CFF', r: 3 }} activeDot={{ r: 5 }} name="Visits" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CCCard>

      {/* Gallery Views Bar Chart */}
      <CCCard padding="lg">
        <h3 className="text-base font-semibold text-[#E8EEF9] mb-4">Gallery Views — Last 8 Weeks</h3>
        {totalGalleryViews === 0 ? (
          <p className="text-center text-sm text-[#6B7A94] py-8">No gallery view data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#263248" />
              <XAxis dataKey="week" tick={{ fill: '#6B7A94', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6B7A94', fontSize: 11 }} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="gallery" fill="#FF2DAA" radius={[4, 4, 0, 0]} name="Gallery Views" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CCCard>
    </div>
  );
}