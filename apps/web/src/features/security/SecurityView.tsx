interface SecurityViewProps {
  spec: Record<string, unknown> | null;
}

export function SecurityView({ spec }: SecurityViewProps) {
  // Support both OpenAPI 3.x (components.securitySchemes) and Swagger 2.0 (securityDefinitions)
  const components = spec?.components as Record<string, unknown> | undefined;
  const openapi3SecuritySchemes = components?.securitySchemes as Record<string, unknown> | undefined;
  const swagger2SecurityDefinitions = spec?.securityDefinitions as Record<string, unknown> | undefined;
  const securitySchemes = openapi3SecuritySchemes || swagger2SecurityDefinitions;
  const security = spec?.security as Array<Record<string, string[]>> | undefined;

  if (!spec) {
    return (
      <div className="panel-card">
        <h2>Security</h2>
        <p className="empty-message">Load a spec to view security configuration.</p>
      </div>
    );
  }

  const hasSecuritySchemes = securitySchemes && Object.keys(securitySchemes).length > 0;
  const hasGlobalSecurity = security && security.length > 0;

  if (!hasSecuritySchemes && !hasGlobalSecurity) {
    return (
      <div className="panel-card">
        <h2>Security</h2>
        <p className="empty-message">No security schemes defined in this specification.</p>
      </div>
    );
  }

  return (
    <div className="security-view">
      <div className="panel-card">
        <h2>Security</h2>
        <p className="text-muted">
          Security schemes and requirements for this API
        </p>
      </div>

      {hasGlobalSecurity && (
        <div className="panel-card">
          <h3>Global Security</h3>
          <ul className="security-list">
            {security!.map((req, idx) => (
              <li key={idx}>
                {Object.entries(req).map(([name, scopes]) => (
                  <span key={name} className="security-requirement">
                    <strong>{name}</strong>
                    {scopes.length > 0 && <span className="scopes">: {scopes.join(", ")}</span>}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasSecuritySchemes && (
        <div className="panel-card">
          <h3>Security Schemes</h3>
          <div className="security-schemes-list">
            {Object.entries(securitySchemes!).map(([name, scheme]) => {
              const schemeObj = scheme as Record<string, unknown>;
              const type = schemeObj.type as string;
              const description = schemeObj.description as string | undefined;
              const bearerFormat = schemeObj.bearerFormat as string | undefined;
              const schemeName = schemeObj.scheme as string | undefined;
              const inLocation = schemeObj.in as string | undefined;
              const paramName = schemeObj.name as string | undefined;

              return (
                <div key={name} className="security-scheme-item">
                  <div className="scheme-header">
                    <h4>{name}</h4>
                    <span className="scheme-type-badge">{type}</span>
                  </div>

                  {description && <p className="scheme-description">{description}</p>}

                  <dl className="scheme-details">
                    {schemeName && (
                      <>
                        <dt>Scheme</dt>
                        <dd>{schemeName}</dd>
                      </>
                    )}
                    {bearerFormat && (
                      <>
                        <dt>Bearer Format</dt>
                        <dd>{bearerFormat}</dd>
                      </>
                    )}
                    {inLocation && (
                      <>
                        <dt>Location</dt>
                        <dd>{inLocation}</dd>
                      </>
                    )}
                    {paramName && (
                      <>
                        <dt>Parameter Name</dt>
                        <dd>{paramName}</dd>
                      </>
                    )}
                  </dl>

                  <details className="scheme-raw">
                    <summary>View JSON</summary>
                    <pre>{JSON.stringify(scheme, null, 2)}</pre>
                  </details>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
