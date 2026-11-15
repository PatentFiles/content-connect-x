import React from 'react';
import { createRoot } from 'react-dom/client';
import SupabaseApp from './SupabaseApp';

document.documentElement.classList.add('dark');
const mount=document.getElementById('root');
if (!mount) throw new Error('Content Connect X root element is missing');
createRoot(mount).render(<SupabaseApp />);
