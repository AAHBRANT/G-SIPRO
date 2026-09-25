import { ContractingPartyField, type Party } from "./contracting-party-field";

export type OpportunityFormValues = Readonly<{
  origin?: string;
  subject?: string;
  estimatedValue?: string;
  currency?: string;
  valueSource?: string;
  publishedAt?: string;
  deliveryAt?: string;
  datesSource?: string;
  datesTimeZone?: string;
  ownerId?: string;
  contractingAuthorityId?: string;
  contractingAuthorityName?: string;
  customerId?: string;
  customerName?: string;
}>;

function currentParty(values: OpportunityFormValues): Party | undefined {
  if (values.contractingAuthorityId && values.contractingAuthorityName) {
    return { id: values.contractingAuthorityId, kind: "AUTHORITY", name: values.contractingAuthorityName };
  }
  if (values.customerId && values.customerName) {
    return { id: values.customerId, kind: "CUSTOMER", name: values.customerName };
  }
  return undefined;
}

export function OpportunityFormFields({
  values = {},
  users = [],
  disabled = false,
}: {
  values?: OpportunityFormValues;
  users?: readonly { id: string; name: string }[];
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold">
          Origem
          <select className="rounded-xl border border-border px-3 py-2 font-normal" defaultValue={values.origin ?? "PORTAL"} disabled={disabled} name="origin">
            <option value="PORTAL">Portal</option>
            <option value="CHANNEL">Canal</option>
            <option value="REFERRAL">Indicação</option>
            <option value="CUSTOMER">Cliente</option>
            <option value="PROSPECTING">Prospecção</option>
          </select>
        </label>
      </div>
      <label className="grid gap-1 text-sm font-semibold">
        Objeto
        <textarea className="min-h-24 rounded-xl border border-border px-3 py-2 font-normal" defaultValue={values.subject} disabled={disabled} maxLength={10000} name="subject" />
      </label>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-1 text-sm font-semibold">
          Valor estimado
          <input className="rounded-xl border border-border px-3 py-2 font-normal" defaultValue={values.estimatedValue} disabled={disabled} min="0" name="estimatedValue" step="0.01" type="number" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Moeda
          <input className="rounded-xl border border-border px-3 py-2 font-normal uppercase" defaultValue={values.currency ?? "BRL"} disabled={disabled} maxLength={3} name="currency" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Fonte do valor
          <input className="rounded-xl border border-border px-3 py-2 font-normal" defaultValue={values.valueSource} disabled={disabled} maxLength={300} name="valueSource" />
        </label>
      </div>
      <ContractingPartyField disabled={disabled} initialParty={currentParty(values)} />
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold">
          Publicação
          <input className="rounded-xl border border-border px-3 py-2 font-normal" defaultValue={values.publishedAt} disabled={disabled} name="publishedAt" type="datetime-local" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Entrega
          <input className="rounded-xl border border-border px-3 py-2 font-normal" defaultValue={values.deliveryAt} disabled={disabled} name="deliveryAt" type="datetime-local" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Fonte das datas
          <input className="rounded-xl border border-border px-3 py-2 font-normal" defaultValue={values.datesSource} disabled={disabled} maxLength={300} name="datesSource" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Fuso das datas
          <input className="rounded-xl border border-border px-3 py-2 font-normal" defaultValue={values.datesTimeZone ?? "America/Sao_Paulo"} disabled={disabled} maxLength={80} name="datesTimeZone" />
        </label>
      </div>
      <label className="grid gap-1 text-sm font-semibold">
        Responsável
        <select className="rounded-xl border border-border px-3 py-2 font-normal" defaultValue={values.ownerId ?? ""} disabled={disabled} name="ownerId">
          <option value="">Não definido</option>
          {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
        </select>
      </label>
    </div>
  );
}
