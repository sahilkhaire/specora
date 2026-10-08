import { safeExternalHref } from "@/shared/safe-url";

/** `info` block of the spec: title, version, description, contact, license. */
export function ApiInfoView({ spec }: { spec: Record<string, unknown> }) {
  const info = (spec.info as Record<string, unknown> | undefined) ?? {};
  const description = typeof info.description === "string" ? info.description : undefined;
  const contact = (info.contact as Record<string, unknown> | undefined) ?? undefined;
  const license = (info.license as Record<string, unknown> | undefined) ?? undefined;
  const contactName = typeof contact?.name === "string" ? contact.name : undefined;
  const contactEmail = typeof contact?.email === "string" ? contact.email : undefined;
  const contactUrl = typeof contact?.url === "string" ? contact.url : undefined;
  const contactMailHref = safeExternalHref(contactEmail ? `mailto:${contactEmail}` : undefined);
  const contactHref = safeExternalHref(contactUrl);
  const licenseHref = safeExternalHref(license?.url);
  const licenseName = String(license?.name ?? license?.url ?? "");

  return (
    <dl className="info-list">
      <dt>Title</dt>
      <dd>{String(info.title ?? "Untitled API")}</dd>

      <dt>Version</dt>
      <dd>{String(info.version ?? "unknown")}</dd>

      {description ? (
        <>
          <dt>Description</dt>
          <dd className="info-description">{description}</dd>
        </>
      ) : null}

      {contactName || contactEmail || contactUrl ? (
        <>
          <dt>Contact</dt>
          <dd>
            {contactName ? <div>{contactName}</div> : null}
            {contactEmail ? (
              <div>{contactMailHref ? <a href={contactMailHref}>{contactEmail}</a> : contactEmail}</div>
            ) : null}
            {contactUrl ? (
              <div>
                {contactHref ? (
                  <a href={contactHref} target="_blank" rel="noopener noreferrer">
                    {contactUrl}
                  </a>
                ) : (
                  contactUrl
                )}
              </div>
            ) : null}
          </dd>
        </>
      ) : null}

      {licenseName ? (
        <>
          <dt>License</dt>
          <dd>
            {licenseHref ? (
              <a href={licenseHref} target="_blank" rel="noopener noreferrer">
                {licenseName}
              </a>
            ) : (
              licenseName
            )}
          </dd>
        </>
      ) : null}
    </dl>
  );
}
