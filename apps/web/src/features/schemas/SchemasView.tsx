interface SchemasViewProps {
  spec: Record<string, unknown> | null;
}

export function SchemasView({ spec }: SchemasViewProps) {
  // Support both OpenAPI 3.x (components.schemas) and Swagger 2.0 (definitions)
  const components = spec?.components as Record<string, unknown> | undefined;
  const openapi3Schemas = components?.schemas as Record<string, unknown> | undefined;
  const swagger2Definitions = spec?.definitions as Record<string, unknown> | undefined;
  const schemas = openapi3Schemas || swagger2Definitions;
  const schemaLocation = openapi3Schemas ? 'components.schemas' : 'definitions';

  if (!spec) {
    return (
      <div className="panel-card">
        <h2>Schemas</h2>
        <p className="empty-message">Load a spec to view schemas.</p>
      </div>
    );
  }

  if (!schemas || Object.keys(schemas).length === 0) {
    return (
      <div className="panel-card">
        <h2>Schemas</h2>
        <p className="empty-message">No schemas defined in this specification.</p>
      </div>
    );
  }

  return (
    <div className="schemas-view">
      <div className="panel-card">
        <h2>Schemas</h2>
        <p className="text-muted">
          {Object.keys(schemas).length} schema(s) defined in {schemaLocation}
        </p>
      </div>

      <div className="schemas-list">
        {Object.entries(schemas).map(([name, schema]) => {
          const schemaObj = schema as Record<string, unknown>;
          const type = schemaObj.type as string | undefined;
          const description = schemaObj.description as string | undefined;
          const properties = schemaObj.properties as Record<string, unknown> | undefined;

          return (
            <div key={name} className="panel-card schema-item">
              <div className="schema-header">
                <h3>{name}</h3>
                {type && <span className="schema-type">{type}</span>}
              </div>
              
              {description && <p className="schema-description">{description}</p>}

              {properties && (
                <details className="schema-properties">
                  <summary>Properties ({Object.keys(properties).length})</summary>
                  <table className="properties-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(properties).map(([propName, propSchema]) => {
                        const prop = propSchema as Record<string, unknown>;
                        return (
                          <tr key={propName}>
                            <td className="prop-name">{propName}</td>
                            <td className="prop-type">{String(prop.type || "")}</td>
                            <td className="prop-desc">{String(prop.description || "")}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </details>
              )}

              <details className="schema-raw">
                <summary>View JSON</summary>
                <pre>{JSON.stringify(schema, null, 2)}</pre>
              </details>
            </div>
          );
        })}
      </div>
    </div>
  );
}
