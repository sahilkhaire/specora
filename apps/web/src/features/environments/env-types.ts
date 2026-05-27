import type { AuthType } from "@/features/tryout/tryout-utils";

export interface EnvAuth {
  type: AuthType;
  /** Token, base64 credentials, or API key value */
  value: string;
  /** Header name for api-key auth */
  keyName: string;
}

export interface Environment {
  id: string;
  name: string;
  /** Base server URL, applied to the Server field in Try It Out */
  baseUrl: string;
  auth: EnvAuth;
  /** Custom key→value pairs; reference as {{varName}} in URLs, headers, and bodies */
  variables: Record<string, string>;
}
