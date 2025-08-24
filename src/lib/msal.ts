import {
  PublicClientApplication,
  type Configuration,
} from "@azure/msal-browser";

const tenantId = process.env.NEXT_PUBLIC_AAD_TENANT_ID!;
const msalConfig: Configuration = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_AAD_CLIENT_ID!,
    authority: `https://login.microsoftonline.com/${tenantId}`, // ⬅️ tenant-specific
    redirectUri:
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:3000",
  },
  cache: { cacheLocation: "localStorage", storeAuthStateInCookie: false },
};

export const msalInstance = new PublicClientApplication(msalConfig);
export const graphScopes = ["User.Read", "Files.ReadWrite"];
