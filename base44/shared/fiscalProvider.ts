export type FiscalProviderContext = {
  document: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
  credentialReference?: string;
};

export interface FiscalProvider {
  validate(context: FiscalProviderContext): Promise<{ errors: string[]; warnings: string[] }>;
  testConnection(context: FiscalProviderContext): Promise<Record<string, unknown>>;
  issue(context: FiscalProviderContext): Promise<Record<string, unknown>>;
  query(externalId: string): Promise<Record<string, unknown>>;
  cancel(externalId: string, reason: string): Promise<Record<string, unknown>>;
  replace(externalId: string, context: FiscalProviderContext): Promise<Record<string, unknown>>;
  downloadXml(externalId: string): Promise<string>;
  downloadPdf(externalId: string): Promise<string>;
}

class UnconfiguredFiscalProvider implements FiscalProvider {
  async validate() {
    return { errors: ["Provedor fiscal não configurado."], warnings: [] };
  }

  private unavailable(): never {
    throw Object.assign(new Error("Provedor fiscal não configurado para esta oficina."), {
      code: "FISCAL_PROVIDER_NOT_CONFIGURED",
      status: 409,
    });
  }

  async issue(): Promise<Record<string, unknown>> { return this.unavailable(); }
  async testConnection(): Promise<Record<string, unknown>> { return this.unavailable(); }
  async query(): Promise<Record<string, unknown>> { return this.unavailable(); }
  async cancel(): Promise<Record<string, unknown>> { return this.unavailable(); }
  async replace(): Promise<Record<string, unknown>> { return this.unavailable(); }
  async downloadXml(): Promise<string> { return this.unavailable(); }
  async downloadPdf(): Promise<string> { return this.unavailable(); }
}

export function createFiscalProvider(provider: string): FiscalProvider {
  // Provider adapters will be registered here after homologation. Keeping the
  // domain contract independent prevents provider payloads leaking into entities.
  if (!provider || provider === "nao_configurado") return new UnconfiguredFiscalProvider();
  return new UnconfiguredFiscalProvider();
}
