import React, { useState, useEffect } from 'react';
import CCSelect from '../ui-custom/CCSelect';

// Comprehensive US states
const usStates = [
  { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' }, { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' }, { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' }, { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' }, { value: 'HI', label: 'Hawaii' }, { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' }, { value: 'IN', label: 'Indiana' }, { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' }, { value: 'KY', label: 'Kentucky' }, { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' }, { value: 'MD', label: 'Maryland' }, { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' }, { value: 'MN', label: 'Minnesota' }, { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' }, { value: 'MT', label: 'Montana' }, { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' }, { value: 'NH', label: 'New Hampshire' }, { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' }, { value: 'NY', label: 'New York' }, { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' }, { value: 'OH', label: 'Ohio' }, { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' }, { value: 'PA', label: 'Pennsylvania' }, { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' }, { value: 'SD', label: 'South Dakota' }, { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' }, { value: 'UT', label: 'Utah' }, { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' }, { value: 'WA', label: 'Washington' }, { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' }, { value: 'WY', label: 'Wyoming' },
];

const countries = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'AU', label: 'Australia' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'ES', label: 'Spain' },
  { value: 'IT', label: 'Italy' },
  { value: 'MX', label: 'Mexico' },
  { value: 'BR', label: 'Brazil' },
];

const usCities = {
  CA: ['Los Angeles', 'San Francisco', 'San Diego', 'Sacramento', 'San Jose', 'Fresno'],
  NY: ['New York City', 'Buffalo', 'Rochester', 'Syracuse', 'Albany'],
  FL: ['Miami', 'Orlando', 'Tampa', 'Jacksonville', 'Fort Lauderdale'],
  TX: ['Houston', 'Dallas', 'Austin', 'San Antonio', 'Fort Worth'],
  NV: ['Las Vegas', 'Reno', 'Henderson', 'Carson City'],
  AZ: ['Phoenix', 'Tucson', 'Mesa', 'Scottsdale'],
  IL: ['Chicago', 'Aurora', 'Naperville', 'Rockford'],
  PA: ['Philadelphia', 'Pittsburgh', 'Allentown', 'Erie'],
  GA: ['Atlanta', 'Augusta', 'Savannah', 'Columbus'],
  WA: ['Seattle', 'Spokane', 'Tacoma', 'Vancouver'],
};

export default function LocationSelector({ value, onChange, className }) {
  const [selectedCountry, setSelectedCountry] = useState(value?.country || '');
  const [selectedState, setSelectedState] = useState(value?.state || '');
  const [selectedCity, setSelectedCity] = useState(value?.city || '');

  useEffect(() => {
    onChange({
      country: selectedCountry,
      state: selectedState,
      city: selectedCity,
    });
  }, [selectedCountry, selectedState, selectedCity]);

  const cityOptions = selectedCountry === 'US' && selectedState
    ? (usCities[selectedState] || []).map(city => ({ value: city, label: city }))
    : [];

  return (
    <div className={className}>
      <div className="grid gap-4">
        <CCSelect
          label="Country"
          options={countries}
          value={selectedCountry}
          onChange={(e) => {
            setSelectedCountry(e.target.value);
            setSelectedState('');
            setSelectedCity('');
          }}
          placeholder="Select country"
        />

        {selectedCountry === 'US' && (
          <CCSelect
            label="State"
            options={usStates}
            value={selectedState}
            onChange={(e) => {
              setSelectedState(e.target.value);
              setSelectedCity('');
            }}
            placeholder="Select state"
          />
        )}

        {selectedCountry === 'US' && selectedState && cityOptions.length > 0 ? (
          <CCSelect
            label="City"
            options={cityOptions}
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            placeholder="Select city"
          />
        ) : (
          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">City</label>
            <input
              type="text"
              placeholder="Enter city name"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:border-[#4F8CFF] transition-all duration-200"
            />
          </div>
        )}
      </div>
    </div>
  );
}