import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, SlidersHorizontal, MapPin, X, Building2 } from 'lucide-react';
import { motion } from 'framer-motion';
import CCEmpty from '@/components/ui-custom/CCEmpty';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import FeatureGate from '@/components/feature/FeatureGate';
import FeatureRouteGuard from '@/components/feature/FeatureRouteGuard.jsx';
import PropertyCard from '@/components/hosting/PropertyCard';
import PropertyFilters from '@/components/hosting/PropertyFilters';

const PROPERTY_TYPES = ['All', 'studio', 'loft', 'house', 'rooftop', 'outdoor', 'warehouse', 'office', 'other'];

export default function HostingMarketplace() {
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ minPrice: '', maxPrice: '', city: '', amenities: [] });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ['activeProperties'],
    queryFn: () => base44.entities.Property.filter({ status: 'active' }, '-created_date', 50),
  });

  // Fetch owner profiles for host cards
  const { data: ownerProfiles = [] } = useQuery({
    queryKey: ['propertyOwnerProfiles', properties],
    queryFn: async () => {
      const ids = [...new Set(properties.map(p => p.owner_user_id).filter(Boolean))];
      if (!ids.length) return [];
      const all = await base44.entities.UserProfile.list();
      return all.filter(p => ids.includes(p.user_id));
    },
    enabled: properties.length > 0,
  });

  const getOwner = (ownerId) => ownerProfiles.find(p => p.user_id === ownerId);

  const filtered = useMemo(() => {
    return properties.filter(p => {
      const q = search.toLowerCase();
      if (q && !p.title?.toLowerCase().includes(q) && !p.city?.toLowerCase().includes(q) && !p.description?.toLowerCase().includes(q)) return false;
      if (selectedType !== 'All' && p.property_type !== selectedType) return false;
      if (filters.city && !p.city?.toLowerCase().includes(filters.city.toLowerCase())) return false;
      if (filters.minPrice && p.pricing?.hourly_rate < parseFloat(filters.minPrice)) return false;
      if (filters.maxPrice && p.pricing?.hourly_rate > parseFloat(filters.maxPrice)) return false;
      if (filters.amenities.length > 0 && !filters.amenities.every(a => p.amenities?.includes(a))) return false;
      return true;
    });
  }, [properties, search, selectedType, filters]);

  if (isLoading) return <CCLoadingScreen message="Loading properties..." />;

  return (
    <FeatureRouteGuard flag="hosting_marketplace">
      <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
        {/* Header */}
        <div className="sticky top-16 z-20 bg-[#0B0F14]/95 backdrop-blur-xl border-b border-[#263248] px-4 py-3">
          <div className="max-w-6xl mx-auto space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7A94]" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search properties by title, city..."
                  className="w-full bg-[#121824] border border-[#263248] rounded-lg pl-9 pr-4 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7A94]">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowFilters(v => !v)}
                className={`p-2 rounded-lg border transition-colors ${showFilters ? 'border-[#4F8CFF] bg-[#4F8CFF]/10 text-[#4F8CFF]' : 'border-[#263248] text-[#9AA6BC] hover:border-[#3A4A6B]'}`}
              >
                <SlidersHorizontal className="w-5 h-5" />
              </button>
              {user && (
                <Link
                  to="/HostDashboard"
                  className="px-3 py-2 bg-[#4F8CFF] hover:bg-[#3A7AEE] text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                >
                  My Properties
                </Link>
              )}
            </div>

            {/* Type pills */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {PROPERTY_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                    selectedType === type
                      ? 'bg-[#4F8CFF] text-white'
                      : 'bg-[#121824] border border-[#263248] text-[#9AA6BC] hover:border-[#3A4A6B]'
                  }`}
                >
                  {type === 'All' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>

            {/* Advanced filters */}
            {showFilters && (
              <PropertyFilters filters={filters} onChange={setFilters} />
            )}
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-6">
          {/* Results count */}
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm text-[#9AA6BC]">
              {filtered.length} {filtered.length === 1 ? 'property' : 'properties'}
              {search && ` for "${search}"`}
            </p>
          </div>

          {filtered.length === 0 ? (
            <CCEmpty
              icon={Building2}
              title="No properties found"
              description="Try adjusting your search or filters."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((property, i) => (
                <motion.div
                  key={property.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <PropertyCard property={property} ownerProfile={getOwner(property.owner_user_id)} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </FeatureRouteGuard>
  );
}