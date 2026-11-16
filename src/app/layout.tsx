import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const TIZEN_POLYFILL_SCRIPT = `
(function() {
  if (typeof globalThis === 'undefined') { window.globalThis = window; }
  if (!Object.hasOwn) {
    Object.hasOwn = function(obj, prop) {
      return Object.prototype.hasOwnProperty.call(obj, prop);
    };
  }
  if (!Object.fromEntries) {
    Object.fromEntries = function(entries) {
      var obj = {};
      for (var i = 0, arr = Array.from(entries); i < arr.length; i++) {
        obj[arr[i][0]] = arr[i][1];
      }
      return obj;
    };
  }
  if (!String.prototype.replaceAll) {
    String.prototype.replaceAll = function(search, replacement) {
      if (search instanceof RegExp) return this.replace(search, replacement);
      return this.split(String(search)).join(String(replacement));
    };
  }
  if (!Array.prototype.at) {
    Array.prototype.at = function(n) {
      n = Math.trunc(n) || 0;
      if (n < 0) n += this.length;
      return n < 0 || n >= this.length ? undefined : this[n];
    };
  }
  if (!String.prototype.at) {
    String.prototype.at = Array.prototype.at;
  }
  if (!Array.prototype.findLast) {
    Array.prototype.findLast = function(cb, thisArg) {
      for (var i = this.length - 1; i >= 0; i--) {
        if (cb.call(thisArg, this[i], i, this)) return this[i];
      }
      return undefined;
    };
  }
  if (!Array.prototype.findLastIndex) {
    Array.prototype.findLastIndex = function(cb, thisArg) {
      for (var i = this.length - 1; i >= 0; i--) {
        if (cb.call(thisArg, this[i], i, this)) return i;
      }
      return -1;
    };
  }
  if (!Array.prototype.toSorted) {
    Array.prototype.toSorted = function(compareFn) {
      return Array.prototype.slice.call(this).sort(compareFn);
    };
  }
  if (!Promise.allSettled) {
    Promise.allSettled = function(promises) {
      return Promise.all(Array.from(promises, function(p) {
        return Promise.resolve(p).then(
          function(value) { return { status: 'fulfilled', value: value }; },
          function(reason) { return { status: 'rejected', reason: reason }; }
        );
      }));
    };
  }
  if (typeof structuredClone === 'undefined') {
    window.structuredClone = function(val) {
      return JSON.parse(JSON.stringify(val));
    };
  }
})();
`.trim();

export const metadata: Metadata = {
  title: "Ambient Dashboard",
  description: "Always-on 24/7 Ambient Wall & Desk Display",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full subpixel-antialiased dark`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: TIZEN_POLYFILL_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-black text-white overflow-hidden">
        {children}
      </body>
    </html>
  );
}
