import { api } from './api';

export type PushPermissionState = 'enabled' | 'not_enabled' | 'denied' | 'unsupported';

/**
 * Converts a base64url string to a Uint8Array for VAPID applicationServerKey
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;
}

/**
 * Registers the Service Worker at root scope
 */
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.error('[WebPush] Service Worker registration failed:', err);
    return null;
  }
}

/**
 * Gets the current push permission state for UI display
 */
export async function getPushState(): Promise<PushPermissionState> {
  if (!isPushSupported()) return 'unsupported';

  if (Notification.permission === 'denied') {
    return 'denied';
  }

  if (Notification.permission !== 'granted') {
    return 'not_enabled';
  }

  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    if (!reg) return 'not_enabled';
    const sub = await reg.pushManager.getSubscription();
    return sub ? 'enabled' : 'not_enabled';
  } catch (err) {
    console.warn('[WebPush] Error checking subscription:', err);
    return 'not_enabled';
  }
}

/**
 * Subscribes the user to real Web Push notifications
 */
export async function subscribeToPushNotifications(): Promise<{
  success: boolean;
  state: PushPermissionState;
  error?: string;
}> {
  if (!isPushSupported()) {
    return {
      success: false,
      state: 'unsupported',
      error: 'Web Push notifications are not supported by this browser.',
    };
  }

  // 1. Request explicit browser notification permission
  const permission = await Notification.requestPermission();
  if (permission === 'denied') {
    return {
      success: false,
      state: 'denied',
      error: 'Notification permission was denied. Please allow notifications in your browser settings.',
    };
  }

  if (permission !== 'granted') {
    return {
      success: false,
      state: 'not_enabled',
      error: 'Notification permission was dismissed.',
    };
  }

  try {
    // 2. Register Service Worker
    const reg = await getServiceWorkerRegistration();
    if (!reg) {
      throw new Error('Could not register Service Worker.');
    }

    // 3. Retrieve VAPID Public Key from server
    const { publicKey } = await api.getVapidPublicKey();
    if (!publicKey) {
      throw new Error('Server did not return a VAPID public key.');
    }

    const applicationServerKey = urlBase64ToUint8Array(publicKey);

    // 4. Check for existing subscription or create new
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    // 5. Store PushSubscription on the server
    await api.savePushSubscription(subscription.toJSON());

    return {
      success: true,
      state: 'enabled',
    };
  } catch (err: any) {
    console.error('[WebPush] Subscription flow failed:', err);
    return {
      success: false,
      state: 'not_enabled',
      error: err.message || 'Failed to complete Web Push subscription.',
    };
  }
}

/**
 * Unsubscribes from Web Push
 */
export async function unsubscribeFromPushNotifications(): Promise<{
  success: boolean;
  state: PushPermissionState;
}> {
  if (!isPushSupported()) {
    return { success: false, state: 'unsupported' };
  }

  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    if (reg) {
      const subscription = await reg.pushManager.getSubscription();
      if (subscription) {
        await api.removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
    } else {
      await api.removePushSubscription();
    }
  } catch (err) {
    console.warn('[WebPush] Error during unsubscribe:', err);
  }

  const newState = await getPushState();
  return { success: true, state: newState };
}
