/**
 * usePlatform — detects whether the app is running on iOS, Android, or Web.
 *
 * Returns:
 *   platform: 'ios' | 'android' | 'web'
 *   isNative: boolean  (true on iOS or Android)
 *   isIOS: boolean
 *   isAndroid: boolean
 *   isWeb: boolean
 *   safeAreaTop: number     — approximate notch/status-bar height in px
 *   safeAreaBottom: number  — approximate home-indicator height in px
 */

import { useMemo } from 'react';

function detect() {
  const ua = navigator.userAgent || '';

  // Capacitor / Cordova bridge
  const hasCapacitor = !!(window.Capacitor?.isNative);
  const hasCordova   = !!(window.cordova);

  if (hasCapacitor || hasCordova) {
    const platform = window.Capacitor?.getPlatform?.() || 'web';
    if (platform === 'ios')     return 'ios';
    if (platform === 'android') return 'android';
  }

  // React Native WebView
  if (window.ReactNativeWebView) {
    const isAndroid = /android/i.test(ua);
    return isAndroid ? 'android' : 'ios';
  }

  // UA sniffing fallback (for standalone PWA or browser)
  const isIOS     = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /android/i.test(ua);

  if (isIOS)     return 'ios';
  if (isAndroid) return 'android';
  return 'web';
}

let _cached = null;

export function usePlatform() {
  return useMemo(() => {
    if (!_cached) _cached = detect();
    const platform = _cached;
    return {
      platform,
      isNative:  platform !== 'web',
      isIOS:     platform === 'ios',
      isAndroid: platform === 'android',
      isWeb:     platform === 'web',
    };
  }, []);
}

export function getPlatform() {
  if (!_cached) _cached = detect();
  return _cached;
}