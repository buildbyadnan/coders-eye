const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {},
): Promise<Response> {
  const { timeout = 30_000, ...fetchOptions } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, { ...fetchOptions, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function constantTimeCompare(a: string, b: string): Promise<boolean> {
  let result = 0;
  const maxLen = Math.max(a.length, b.length);
  for (let i = 0; i < maxLen; i++) {
    const aCode = i < a.length ? a.charCodeAt(i) : 0;
    const bCode = i < b.length ? b.charCodeAt(i) : 0;
    result |= aCode ^ bCode;
  }
  return result === 0 && a.length === b.length;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function newIv(): ArrayBuffer {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const buf = new ArrayBuffer(12);
  new Uint8Array(buf).set(bytes);
  return buf;
}

export async function encrypt(data: string, secret: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("coders-eye-salt"),
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );

  const iv = newIv();
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(data),
  );

  return bytesToBase64(new Uint8Array(iv)) + "." + bytesToBase64(new Uint8Array(encrypted));
}

export async function decrypt(encryptedData: string, secret: string): Promise<string> {
  const [ivB64, dataB64] = encryptedData.split(".");
  const ivBytes = base64ToBytes(ivB64);
  const dataBytes = base64ToBytes(dataB64);

  const iv = new ArrayBuffer(ivBytes.length);
  new Uint8Array(iv).set(ivBytes);

  const data = new ArrayBuffer(dataBytes.length);
  new Uint8Array(data).set(dataBytes);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("coders-eye-salt"),
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  );

  return decoder.decode(decrypted);
}
