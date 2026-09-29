// sw.js - Service worker for KurdMDb's personal reminders push notifications.
//
// WHERE THIS GOES: save this file as `sw.js` at the ROOT of the same domain
// Index_39.html is served from (e.g. https://yourdomain.com/sw.js), sitting
// next to it, NOT inside a subfolder. Index_39.html registers it with
// navigator.serviceWorker.register('/sw.js') - a root path, so its scope
// covers the whole site regardless of which folder Index_39.html itself
// lives in. If your host truly cannot serve a file at the exact root, you
// can register it from a subfolder instead, but then its scope only covers
// that subfolder, and Index_39.html's register('/sw.js') call must be
// changed to match that path too.
//
// WHAT IT DOES: nothing at all until the browser's OS-level push service
// wakes it up with an actual message - this is what "runs even with the
// site closed" actually means in a browser. There is no polling and no
// open connection kept alive on your device; the browser vendor's own push
// infrastructure (Google's for Chrome/Edge, Mozilla's for Firefox, Apple's
// for Safari) delivers the message to this script directly, then this
// script is the thing that turns that message into the OS notification you
// see. It briefly wakes to run this exact handler, shows the notification,
// and then goes back to sleep - it is not a background process running
// continuously on the device.

self.addEventListener('push', (event) => {
  let payload = { title: 'ئاگادارکەرەوە', body: '' };
  try {
    if (event.data) payload = event.data.json();
  } catch (e) {
    // If the push server ever sends plain text instead of JSON for any
    // reason, fall back to showing it as the body rather than dropping the
    // notification entirely.
    payload.body = event.data ? event.data.text() : '';
  }

  const title = payload.title || 'ئاگادارکەرەوە';
  const options = {
    body: payload.body || '',
    icon: 'https://cdn.phototourl.com/free/2026-08-25-4787b359-1032-4643-93c0-9802296e2668.png',
    badge: 'https://cdn.phototourl.com/free/2026-08-25-4787b359-1032-4643-93c0-9802296e2668.png',
    data: { url: payload.url || '/' },
    // Ties this notification to its reminder id so a second push for the
    // SAME reminder (which should never happen once the Edge Function marks
    // it notified=true, but is a harmless safety net if it ever did) replaces
    // the existing OS notification instead of stacking a duplicate.
    tag: payload.reminderId ? ('reminder-' + payload.reminderId) : undefined
  };

  // event.waitUntil keeps the service worker alive just long enough to finish
  // showing the notification before it's allowed to go back to sleep -
  // required here, not optional, or the browser can suspend the worker
  // mid-way through showNotification() on a slow device.
  event.waitUntil(self.registration.showNotification(title, options));
});

// Clicking the OS notification focuses an already-open tab of the site if
// one exists, or opens a new one otherwise - standard behavior for a PWA
// notification, so tapping it always lands the person back on the site
// rather than just dismissing silently.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
