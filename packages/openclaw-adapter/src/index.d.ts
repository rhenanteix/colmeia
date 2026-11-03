export declare const OPENCLAW_IMAGE: string;
export declare function encryptionKey(): Buffer;
export declare function encryptSecret(value: string, organizationId: string): string;
export declare function decryptSecret(value: string, organizationId: string): string;
export declare function runtimeNames(id: string): {
  container: string;
  volume: string;
  network: string;
};
export declare function gatewayHealth(url: string, token: string): Promise<string[]>;
